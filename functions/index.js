const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const USERS_COLLECTION_PATH = 'artifacts/regulafacil/public/data/usuarios';

const normalizeText = (text = '') =>
  text
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const ensureAdminRequester = async (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Somente usuários autenticados podem criar novos usuários.'
    );
  }

  const requesterRole = context.auth.token?.role;
  const requesterTipoUsuario = context.auth.token?.tipoUsuario;
  const isAdminByClaims =
    (requesterRole && ['admin', 'Administrador'].includes(requesterRole)) ||
    requesterTipoUsuario === 'Administrador';

  if (isAdminByClaims) {
    return;
  }

  const requesterUid = context.auth.uid;

  if (!requesterUid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Somente administradores podem criar novos usuários.'
    );
  }

  const requesterSnapshot = await admin
    .firestore()
    .doc(`${USERS_COLLECTION_PATH}/${requesterUid}`)
    .get();

  const requesterData = requesterSnapshot.data();
  const isAdminByProfile = requesterData?.tipoUsuario === 'Administrador';

  if (!isAdminByProfile) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Somente administradores podem criar novos usuários.'
    );
  }
};

const validatePayload = (data) => {
  const requiredFields = ['email', 'password', 'nomeCompleto', 'matricula', 'tipoUsuario'];
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `O campo "${field}" é obrigatório.`
      );
    }
  }

  if (typeof data.email !== 'string' || !data.email.endsWith('@joinville.sc.gov.br')) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'O e-mail deve terminar com @joinville.sc.gov.br.'
    );
  }

  if (typeof data.password !== 'string' || data.password.length < 6) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'A senha deve conter ao menos 6 caracteres.'
    );
  }
};

exports.createNewUser = functions.https.onCall(async (data, context) => {
  await ensureAdminRequester(context);
  validatePayload(data);

  const email = data.email.toLowerCase();
  const password = data.password;
  const nomeCompleto = normalizeText(data.nomeCompleto);
  const tipoUsuario = data.tipoUsuario;
  const matricula = data.matricula?.toString();
  const permissoes = Array.isArray(data.permissoes) && tipoUsuario === 'Comum' ? data.permissoes : [];
  const qtdAcessos = typeof data.qtdAcessos === 'number' ? data.qtdAcessos : 0;
  const ultimoAcesso = data.ultimoAcesso ?? null;

  try {
    const usersCollection = admin.firestore().collection(USERS_COLLECTION_PATH);

    const [matriculaSnapshot, emailSnapshot] = await Promise.all([
      usersCollection.where('matricula', '==', matricula).limit(1).get(),
      usersCollection.where('emailInstitucional', '==', email).limit(1).get(),
    ]);

    if (!matriculaSnapshot.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Esta matrícula já está cadastrada.'
      );
    }

    if (!emailSnapshot.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Este e-mail já está cadastrado.'
      );
    }

    try {
      await admin.auth().getUserByEmail(email);
      throw new functions.https.HttpsError(
        'already-exists',
        'Uma conta com este e-mail já existe no Firebase Authentication.'
      );
    } catch (authLookupError) {
      if (authLookupError.code !== 'auth/user-not-found') {
        throw authLookupError;
      }
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nomeCompleto,
      disabled: false,
    });

    const customClaims = {
      role: tipoUsuario === 'Administrador' ? 'admin' : 'user',
      tipoUsuario,
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    const userDoc = {
      uid: userRecord.uid,
      nomeCompleto,
      matricula,
      emailInstitucional: email,
      tipoUsuario,
      permissoes,
      qtdAcessos,
      ultimoAcesso,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().doc(`${USERS_COLLECTION_PATH}/${userRecord.uid}`).set(userDoc);

    return {
      uid: userRecord.uid,
      email,
      tipoUsuario,
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    console.error('Erro ao criar usuário via Cloud Function:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Ocorreu um erro ao criar o usuário. Tente novamente mais tarde.'
    );
  }
});
