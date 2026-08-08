import axios from 'axios';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const firebaseConfig = { /* tu config de Firebase */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { email, password, username } = req.body;

    try {
        // 1. Crear usuario en Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // 2. Crear usuario en Pterodactyl
        const pteroResponse = await axios.post(
            `${process.env.PTERODACTYL_PANEL_URL}/api/application/users`,
            {
                email: email,
                username: username || email.split('@')[0],
                first_name: username || email.split('@')[0],
                last_name: 'User',
                password: password, // Pterodactyl también guarda la contraseña
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );

        const pteroUser = pteroResponse.data.attributes;

        res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente',
            user: {
                id: pteroUser.id,
                email: pteroUser.email,
                username: pteroUser.username,
            }
        });
    } catch (error) {
        console.error('Error en registro:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
}
