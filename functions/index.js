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
  if (requesterRole !== 'Administrador') {
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

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: tipoUsuario });

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
