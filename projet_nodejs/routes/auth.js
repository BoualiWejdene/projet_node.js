const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const multer = require('multer');
const path = require('path')
const router = express.Router();
const url = 'mongodb://localhost:27017';
const dbName = 'db_elections'; 
MongoClient.connect(url)
.then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
})
.catch(err => {console.error(error)});
// Configuration de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Type de fichier non supporté. Seuls les JPEG, PNG et GIF sont autorisés.'));
        }
        cb(null, true);
    }
});

// Middleware d'upload avec gestion des erreurs
router.post('/register', (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Erreur lors de l’upload de la photo :', err.message);
            return res.status(400).json({ message: 'Erreur lors de l’upload de la photo : ' + err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const photoPath = req.file ? req.file.path : null;
        console.log('Chemin de la photo uploadée :', photoPath);

        const {  nom_user,
            prenom_user,
            age,
            photo,
            region,
            email,
            mot_de_passe,
            genre,
            ResiderEnTunisie } = req.body;
  const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        await db.collection('Utilisateurs').insertOne({
            nom_user,
            prenom_user,
            age,
            region,
            photo : photoPath,
            region,
            email,
            mot_de_passe: hashedPassword, 
            genre,
            ResiderEnTunisie,
            favoris:[]
        });
    
        res.redirect('/login');
    } catch (error) {
        console.error('Erreur lors de l’inscription :', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }

    
});


router.post("/login", async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

        const user = await db.collection("Utilisateurs").findOne({ email });
        if (user == null) {
            return res.status(400).send("Utilisateur non trouvé");
        }

        const passwordMatch = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!passwordMatch){
            return res.status(400).send("Mot de passe incorrect");
        }
        // Créer un JWT
        const token = jwt.sign(
            { userId: user._id },   
            's147Bipmf78455wkjjhhghghgggfstyftpm',    
            { expiresIn: '1h' }   
        );
        req.session.userId = user._id;
        // Stocker le token dans un cookie ou l'envoyer dans la réponse
        res.cookie('jwt', token, { httpOnly: true, secure: false }); 
        res.redirect(`/profile/${user._id}`);
    } catch (err) {
        console.error("Erreur lors de la connexion :", err);
        res.status(500).send("Erreur serveur.");
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('jwt');  
    res.redirect('/login');
});
module.exports = router;
