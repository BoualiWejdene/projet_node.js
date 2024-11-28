// auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const router = express.Router();
const url = 'mongodb://localhost:27017';
const dbName = 'db_elections'; 
const client = new MongoClient(url);

MongoClient.connect(url)
.then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
})
.catch(err => {console.error(error)});


// Middleware pour parser le corps de la requête
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Route POST pour l'inscription d'un utilisateur
router.post('/register', async (req, res) => {
    try {
        
        const usersCollection = db.collection('Utilisateurs');

        const {
            nom_user,
            prenom_user,
            age,
            photo,
            region,
            email,
            mot_de_passe,
            genre,
            ResiderEnTunisie,
        } = req.body;

        // Vérification de l'existence de l'utilisateur
        const userExists = await usersCollection.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

        const newUser = {
            nom_user,
            prenom_user,
            age,
            photo,
            region,
            email,
            mot_de_passe: hashedPassword, // On stocke le mot de passe haché
            genre,
            ResiderEnTunisie,
        };

        // Insertion dans la collection
        await usersCollection.insertOne(newUser);

        res.redirect("/login");
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue' });
    }
});


module.exports = router;
