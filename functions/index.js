const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const USERS_COLLECTION_PATH = 'artifacts/regulafacil/public/data/usuarios';

exports.createNewUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Somente usuários autenticados podem criar novos usuários.'
    );
  }

  const requesterRole = context.auth.token?.role;
  const requesterTipoUsuario = context.auth.token?.tipoUsuario;
  const hasAdminClaim =
    requesterRole === 'admin' ||
    requesterRole === 'Administrador' ||
    requesterTipoUsuario === 'Administrador';

  if (!hasAdminClaim) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Apenas administradores podem criar novos usuários.'
    );
  }

  const {
    email,
    password,
    nomeCompleto,
    tipoUsuario,
    permissoes = [],
    matricula = '',
    qtdAcessos = 0,
    ultimoAcesso = null
  } = data || {};

  if (!email || !password || !nomeCompleto || !tipoUsuario) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email, senha, nome completo e tipo de usuário são obrigatórios.'
    );
  }

  if (!/^.+@joinville\.sc\.gov\.br$/i.test(email)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'O e-mail deve pertencer ao domínio @joinville.sc.gov.br.'
    );
  }

  if (!['Administrador', 'Comum'].includes(tipoUsuario)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Tipo de usuário inválido.'
    );
  }

  const normalizarTexto = (texto) =>
    texto
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const firestore = admin.firestore();

  try {
    const userRecord = await admin.auth().createUser({
      email: email.toLowerCase(),
      password,
      displayName: normalizarTexto(nomeCompleto)
    });

    const customClaims = {
      role: tipoUsuario === 'Administrador' ? 'admin' : 'user',
      tipoUsuario
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    const usuarioFirestore = {
      uid: userRecord.uid,
      nomeCompleto: normalizarTexto(nomeCompleto),
      matricula: String(matricula),
      emailInstitucional: email.toLowerCase(),
      tipoUsuario,
      permissoes: Array.isArray(permissoes) ? permissoes : [],
      qtdAcessos,
      ultimoAcesso,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await firestore.collection(USERS_COLLECTION_PATH).add(usuarioFirestore);

    return {
      uid: userRecord.uid,
      message: 'Usuário criado com sucesso.'
    };
  } catch (error) {
    console.error('Erro ao criar usuário via função:', error);

    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError(
        'already-exists',
        'Este e-mail já está cadastrado.'
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erro ao criar o usuário.'
    );
  }
});

exports.bootstrapAdminClaims = functions.https.onCall(async (_, context) => {
  const requesterRole = context.auth?.token?.role;
  const requesterTipoUsuario = context.auth?.token?.tipoUsuario;
  const hasAdminClaim =
    requesterRole === 'admin' ||
    requesterRole === 'Administrador' ||
    requesterTipoUsuario === 'Administrador';

  if (!context.auth || !hasAdminClaim) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Somente administradores autenticados podem executar esta operação.'
    );
  }

  const firestore = admin.firestore();

  try {
    const adminUsersSnapshot = await firestore
      .collection(USERS_COLLECTION_PATH)
      .where('tipoUsuario', '==', 'Administrador')
      .get();

    if (adminUsersSnapshot.empty) {
      return {
        updatedAdmins: 0,
        message: 'Nenhum administrador encontrado para atualizar.'
      };
    }

    const updatePromises = [];

    adminUsersSnapshot.forEach((doc) => {
      const data = doc.data();
      const targetUid = data.uid || doc.id;

      if (!targetUid) {
        functions.logger.warn(
          `Documento de usuário ${doc.id} não possui UID associado. Ignorando.`
        );
        return;
      }

      updatePromises.push(
        admin.auth().setCustomUserClaims(targetUid, {
          role: 'admin',
          tipoUsuario: 'Administrador'
        })
      );
    });

    const results = await Promise.allSettled(updatePromises);

    const updatedAdmins = results.filter((result) => result.status === 'fulfilled')
      .length;

    if (updatedAdmins !== updatePromises.length) {
      const rejected = results.filter((result) => result.status === 'rejected');
      rejected.forEach((result) => {
        functions.logger.error('Falha ao atualizar claim de administrador:', result);
      });
    }

    return {
      updatedAdmins,
      message: 'Claims de administradores atualizadas com sucesso.'
    };
  } catch (error) {
    functions.logger.error('Erro ao executar bootstrapAdminClaims:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Falha ao atualizar os custom claims dos administradores.'
    );
  }
});

exports.syncUserClaimsOnUpdate = functions.firestore
  .document(`${USERS_COLLECTION_PATH}/{userId}`)
  .onUpdate(async (change, context) => {
    const beforeTipoUsuario = change.before.data()?.tipoUsuario;
    const afterTipoUsuario = change.after.data()?.tipoUsuario;

    if (beforeTipoUsuario === afterTipoUsuario) {
      return null;
    }

    const userId = context.params.userId;
    const targetUid = change.after.data()?.uid || userId;

    if (!targetUid) {
      functions.logger.warn(
        `Documento de usuário ${userId} não possui UID associado. Claims não foram atualizadas.`
      );
      return null;
    }

    const isAdmin = afterTipoUsuario === 'Administrador';
    const customClaims = {
      role: isAdmin ? 'admin' : 'user',
      tipoUsuario: afterTipoUsuario || null
    };

    try {
      await admin.auth().setCustomUserClaims(targetUid, customClaims);
      functions.logger.info(
        `Custom claims do usuário ${targetUid} atualizadas para ${JSON.stringify(
          customClaims
        )}.`
      );
    } catch (error) {
      functions.logger.error(
        `Erro ao atualizar custom claims do usuário ${targetUid}:`,
        error
      );
    }

    return null;
  });
