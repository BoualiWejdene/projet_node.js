const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const session = require("express-session");
const http = require("http"); // Importer le module HTTP
const authenticateJWT = require("./middlewares/auth.js");
const auth = require("./routes/auth.js");
const cookieParser = require('cookie-parser');

const { Server } = require('socket.io');

const socketIo = require('socket.io');

const app = express();
app.set("view engine", "ejs");
app.use(express.static('public'));
const server = http.createServer(app);

// Connexion à MongoDB
const mongoose = require("mongoose");
mongoose.connect('mongodb://localhost:27017/database_name')
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("Error connecting to MongoDB", err);
    });

// Schéma pour les résultats des élections
const ResultSchema = new mongoose.Schema({
    candidate: String,
    votes: { type: Number, default: 0 }
});

// Créer un modèle à partir du schéma
const Result = mongoose.model('Result', ResultSchema);

// Initialiser Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",  // Permet toutes les origines pendant le développement
        methods: ["GET", "POST"]
    }
});

// Événement de connexion de Socket.IO
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');  // Affichage dans la console quand un utilisateur se connecte
    socket.emit('message', 'Bonjour du serveur!');
    socket.on("miseAJourVotes", () => {
        socket.emit("resultats", candidats); // Envoyer la liste mise à jour
    });
    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

// Servir un fichier HTML pour tester la connexion
app.get('/test', (req, res) => {
    res.sendFile(__dirname + '/test.html');
});


app.get('/api/results', async (req, res) => {
    try {
        // Récupérer les résultats des votes
        const results = await Result.find({});
        res.json(results);
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération des résultats');
    }
});




//connexion a mongodb
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'db_elections';
let db;
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'votre_secret_de_session',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));
app.use(cookieParser());
app.use(express.static('public'));

MongoClient.connect(url)
.then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
})
.catch(err => {console.error(error)});

app.use('/auth',auth)
// Exemple de route pour servir la page
// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/index.html');  // Assurez-vous que le chemin est correct
//   });
  
//   // Exemple d'écoute des connexions Socket.IO
//   io.on('connection', (socket) => {
//     console.log('Un utilisateur est connecté');
  
//     // Écoutez les événements du côté client ici...
//   });

// signup
app.get("/register",async(req,res)=>{
    res.render("view_signup");
})

// get Users
app.get('/users',async(req,res)=>{
    const utilisateurs =await db.collection('Utilisateurs').find().toArray();
    console.log(utilisateurs);
    res.render('view_user',{utilisateurs});
})

// login
app.get("/login", (req, res) => {
    res.render("login"); 
  });

  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  
  app.post("/login", async (req, res) => {
      try {
          const { email, mot_de_passe } = req.body;
  
          const user = await db.collection("Utilisateurs").findOne({ email });
          if (user == null) {
              return res.status(400).send("Utilisateur non trouvé");
          }
  
          // Vérification du mot de passe avec bcrypt
          if (mot_de_passe!=user.mot_de_passe) {
              return res.status(400).send("Mot de passe incorrect");
          }
  
          // Créer un JWT
          const token = jwt.sign(
              { userId: user._id },   // Payload
              's147Bipmf78455wkjjhhghghgggfstyftpm',     // Clé secrète
              { expiresIn: '1h' }     // Expiration du token
          );
          req.session.userId = user._id;
          // Stocker le token dans un cookie ou l'envoyer dans la réponse
          res.cookie('jwt', token, { httpOnly: true, secure: false }); // Mettre `secure: true` en production si https
          res.redirect(`/profile/${user._id}`);
      } catch (err) {
          console.error("Erreur lors de la connexion :", err);
          res.status(500).send("Erreur serveur.");
      }
  });
  

// get candidats
app.get('/candidats',authenticateJWT,async(req,res)=>{
    const candidats =await db.collection('Candidat').find().toArray();
    console.log(candidats);
    res.render('view_candidat',{candidats});
})
// get candidat by id
app.get('/candidat/:id', authenticateJWT,async (req, res) => {
  try {
      const candidatId = req.params.id;
      const userId = req.session.userId;

      if (!ObjectId.isValid(candidatId)) {
          return res.status(400).send("ID du candidat invalide");
      }

      const candidat = await db.collection("Candidat").findOne({ _id: new ObjectId(candidatId) });
      if (!candidat) {
          return res.status(404).send("Candidat non trouvé");
      }

      const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
      if (!user) {
          return res.status(404).send("Utilisateur non trouvé");
      }
      const user_name=user.nom_user + user.prenom_user;


      const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });
      const commentaires = await db.collection("Commentaire").find({ candidatId: candidatId }).toArray();
      const userIds = commentaires.map(comment => new ObjectId(comment.userId));

        // Récupérer les utilisateurs associés à ces IDs
        const utilisateurs = await db.collection("Utilisateurs")
        .find({ _id: { $in: userIds } })
        .toArray();

        // Associer chaque commentaire à l'utilisateur correspondant
        const commentairesAvecUtilisateurs = commentaires.map(commentaire => {
        const utilisateur = utilisateurs.find(user => user._id.toString() === commentaire.userId.toString());
        return {
            ...commentaire,
            userDetails: utilisateur ? { nom_user: utilisateur.nom_user, prenom_user: utilisateur.prenom_user } : null,
        };
        });

      res.render('view_candidat_profile', { 
          candidat,
          user, 
          hasVoted: !!voteExist, 
          commentaires:commentairesAvecUtilisateurs,
          alertMessage: null,
      });
  } catch (err) {
      console.error("Erreur lors de la récupération du profil du candidat :", err);
      res.status(500).send("Erreur serveur.");
  }
});


app.get('/profile/:id',authenticateJWT,async (req, res) => {
  try {
      const userId = req.params.id;
      const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
      if (!user) {
          return res.status(404).send("Utilisateur non trouvé");
      }
      const searchQuery = req.query.search || "";
      const filter = searchQuery
        ? {
            $or: [
                { nom_candidat: { $regex: searchQuery, $options: "i" } }, // recherche par nom
                { parti: { $regex: searchQuery, $options: "i" } }         // recherche par parti
            ]
        }
        : {}; //aucun filtre si recherche vide
        const candidats = await db.collection("Candidat").find(filter).toArray();
      res.render('view_profile', { user, candidats, searchQuery });
    } catch (err) {
      console.error("Erreur lors de la récupération du profil :", err);
      res.status(500).send("Erreur serveur.");
  }
});


// app.post('/vote/:id', async (req, res) => {
//   try {
//       const candidatId = req.params.id;
//       const userId = req.session.userId;

//       if (!ObjectId.isValid(candidatId)) {
//           return res.status(400).send("ID du candidat invalide");
//       }

//       const candidat = await db.collection("Candidat").findOne({ _id: new ObjectId(candidatId) });
//       if (!candidat) {
//           return res.status(404).send("Candidat non trouvé");
//       }

//       const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
//       if (!user) {
//           return res.status(404).send("Utilisateur non trouvé");
//       }

  
//       const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

//       if (voteExist) {
//           return res.render('view_candidat_profile', { 
//               candidat, 
//               user, 
//               hasVoted: true, 
//               alertMessage: "Vous avez déjà voté pour ce candidat." // Message d'alerte
//           });
//       }

//       await db.collection("Votes").insertOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

      
//       await db.collection("Candidat").updateOne(
//           { _id: new ObjectId(candidatId) },
//           { $inc: { nbVotes: 1 } }
//       );

//       res.redirect(`/candidat/${candidatId}`);
//   } catch (err) {
//       console.error("Erreur lors du vote :", err);
//       res.status(500).send("Erreur serveur.");
//   }
// });

app.post('/vote/:id',async (req, res) => {
    try {
      const candidatId = req.params.id;
      const userId = req.session.userId;
  
      if (!ObjectId.isValid(candidatId)) {
        return res.status(400).send("ID du candidat invalide");
      }
  
      const candidat = await db.collection("Candidat").findOne({ _id: new ObjectId(candidatId) });
      if (!candidat) {
        return res.status(404).send("Candidat non trouvé");
      }
  
      const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).send("Utilisateur non trouvé");
      }
      const commentaires = await db.collection("Commentaire").find({ candidatId: candidatId }).toArray();

      const userIds = commentaires.map(comment => new ObjectId(comment.userId));

  
      // bch talkani zedt commentaires houni khater vote w comment yhezou lnafs lvue 
      //donc ki yemchi lpost mta3 lvote lel vue meghir commentaires wyalkaha commentaires fel vue mahouch bch yekhdem 
      const utilisateurs = await db.collection("Utilisateurs")
        .find({ _id: { $in: userIds } })
        .toArray();
      const voteExist = await db.collection("Votes").findOne({userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

      const commentairesAvecUtilisateurs = commentaires.map(commentaire => {
        const utilisateur = utilisateurs.find(user => user._id.toString() === commentaire.userId.toString());
        return {
            ...commentaire,
            userDetails: utilisateur ? { nom_user: utilisateur.nom_user, prenom_user: utilisateur.prenom_user } : null,
        };
        });
      if (voteExist) {
        return res.render('view_candidat_profile', { 
          candidat, 
          user, 
          commentaires:commentairesAvecUtilisateurs,
          hasVoted: true, 
          alertMessage: "Vous avez déjà voté pour ce candidat." 
        });
      }
  
      // Enregistrer le vote
      await db.collection("Votes").insertOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });
  
 
  
      await db.collection("Candidat").updateOne(
        { _id: new ObjectId(candidatId) },
        { $inc: { nbVotes: 1 } }
      );
      
      // Émettre les résultats mis à jour
      const candidats = await db.collection("Candidat").find().toArray();
      io.emit('resultats', candidats);
      res.redirect(`/candidat/${candidatId}`);
    } catch (err) {
      console.error("Erreur lors du vote :", err);
      res.status(500).send("Erreur serveur.");
    }
  });
  io.on("connection", (socket) => {
    console.log("Un utilisateur est connecté");

    // Envoyer la liste des candidats au client connecté
    db.collection("Candidat")
        .find()
        .toArray()
        .then((candidats) => {
            socket.emit("resultats", candidats);
        })
        .catch((error) => console.error("Erreur lors de la récupération des candidats :", error));

    // Gérer la déconnexion
    socket.on("disconnect", () => {
        console.log("Un utilisateur s'est déconnecté");
    });
});

// Ajouter candidat à la liste des favoris 
app.post('/favori/:id', async (req, res) => {
    try {
        const candidatId = req.params.id;
        const userId = req.session.userId;

        if (!ObjectId.isValid(candidatId)) {
            return res.status(400).send("ID du candidat invalide");
        }

        const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).send("Utilisateur non trouvé");
        }

        const isFavori = user.favoris && user.favoris.includes(candidatId);

        if (isFavori) {
            // Supprimer des favoris
            await db.collection("Utilisateurs").updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { favoris: candidatId } }
            );
        } else {
            // Ajouter aux favoris
            await db.collection("Utilisateurs").updateOne(
                { _id: new ObjectId(userId) },
                { $addToSet: { favoris: candidatId } }
            );
        }

        // Redirection vers la liste des favoris après mise à jour
        res.redirect(`/profile/${userId}/favoris`);
    } catch (err) {
        console.error("Erreur lors de la mise à jour des favoris :", err);
        res.status(500).send("Erreur serveur.");
    }
});



  
//liste des candidats
app.get('/profile/:id/favoris', async (req, res) => {
    try {
        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).send("ID utilisateur invalide.");
        }

        const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
        if (!user || !user.favoris) {
            return res.status(404).send("Favoris introuvables.");
        }

        // Récupérez les informations des candidats favoris
        const favoris = await db.collection("Candidat")
            .find({ _id: { $in: user.favoris.map(id => new ObjectId(id)) } })
            .toArray();

        res.render('view_favoris', { favoris });
    } catch (err) {
        console.error("Erreur lors de la récupération des favoris :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// Route pour afficher le formulaire de modification du profil
app.get('/edit-profile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).send("Utilisateur non trouvé");
        }

      // Afficher la vue de modification de profil
      res.render('view_edit_profile', { user });
    } catch (err) {
        console.error("Erreur lors de l'affichage du profil :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// Route pour mettre à jour le profil
app.post('/profile/update/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const updatedData = {
            nom_user: req.body.nom_user,
            prenom_user: req.body.prenom_user,
            age: req.body.age,
            photo: req.body.photo,
            region: req.body.region,
            email: req.body.email,
            genre: req.body.genre,
            ResiderEnTunisie: req.body.ResiderEnTunisie
        };

        const result = await db.collection("Utilisateurs").updateOne(
            { _id: new ObjectId(userId) },
            { $set: updatedData }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).send("Aucune modification effectuée.");
        }

        res.redirect(`/profile/${userId}`); // Rediriger vers la page de profil mise à jour
    } catch (err) {
        console.error("Erreur lors de la mise à jour du profil :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// Résultat
// Route pour afficher les résultats
// app.get('/resultats', async (req, res) => {
//     try {
//       const candidats = await db.collection('Candidat').find().toArray();
//       res.render('view_resultats', { candidats });
//     } catch (err) {
//       console.error('Erreur lors de la récupération des résultats:', err);
//       res.status(500).send('Erreur serveur.');
//     }
//   });
  
  // Fonction pour émettre les résultats en temps réel
//   function emitResults() {
//     db.collection('Candidat').find().toArray()
//       .then(candidats => {
//         io.emit('resultats_update', { candidats }); // Envoi des résultats à tous les clients
//       })
//       .catch(err => console.error(err));
//     }
    
    // Route pour simuler la mise à jour des résultats (par exemple, lors d'un vote)
// app.post('/updateResults', (req, res) => {
//     // Mettez à jour les résultats dans la base de données (exemple)
//     db.collection('Candidat').updateOne(
//       { _id: req.body.candidatId },
//       { $inc: { nbVotes: 1 } } // Incrémente le nombre de votes
//     ).then(() => {
//       emitResults(); // Emet les résultats en temps réel
//       res.send('Résultats mis à jour');
//     }).catch(err => {
//       console.error('Erreur de mise à jour des résultats:', err);
//       res.status(500).send('Erreur serveur.');
//     });
//   });
app.post('/update/:candidate', async (req, res) => {
    const candidateName = req.params.candidate;
    const candidate = await Result.findOne({ candidate: candidateName });
    if (candidate) {
      candidate.votes += 1;
      await candidate.save();
      io.emit('resultsUpdated'); // Informe tous les clients
      res.send('Mise à jour réussie');
    } else {
      res.status(404).send('Candidat non trouvé');
    }
  });
  
app.post('/comment/:id', async (req, res) => {
    try {
        const candidatId = req.params.id; // L'ID du candidat
        const userId = req.session.userId; // L'ID de l'utilisateur connecté
        const contenue= req.body.contenue; // Le contenu du commentaire

        if (!contenue) {
            return res.status(400).json({ error: "Contenu, userId ou candidatId manquant" });
        }

        const newComment = {
            contenue: contenue,
            date_ajout: new Date(), // Date actuelle
            nb_likes: 0, // Likes par défaut
            nb_dislikes: 0, // Dislikes par défaut
            userId: userId,
            candidatId: candidatId
        };

        // Supposons que `db` est déjà configuré pour accéder à la base MongoDB
        const commentsCollection = db.collection('Commentaire'); // Nom de la collection
        const result = await commentsCollection.insertOne(newComment); // Insertion du commentaire
        return res.redirect(`/candidat/${candidatId}`);
    } catch (err) {
        return res.status(500).json({
            error: "Erreur lors de l'ajout du commentaire",
            details: err.message
        });
    }
});
// Connexion au client MongoDB
MongoClient.connect(url)
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    })
    .catch(err => { console.error(err) });

// Route pour récupérer les résultats des élections
app.get('/api/results', async (req, res) => {
    try {
        // Récupérer les candidats et leurs votes
        const candidats = await db.collection('Candidat').find({}).toArray();
        
        // Formater les résultats avec les informations des candidats et leurs votes
        const results = candidats.map(candidat => ({
            candidate: candidat.nom,
            votes: candidat.votes || 0  // Assurer que les votes existent, sinon 0
        }));

        res.json(results);
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération des résultats');
    }
});

// Route pour afficher la page de test
app.get('/test', (req, res) => {
    res.sendFile(__dirname + '/test.html');
});

// Route pour enregistrer un nouveau vote
app.post('/vote/:id', async (req, res) => {
    try {
        const candidatId = req.params.id;
        const userId = req.session.userId;

        if (!ObjectId.isValid(candidatId)) {
            return res.status(400).send("ID du candidat invalide");
        }

        const candidat = await db.collection("Candidat").findOne({ _id: new ObjectId(candidatId) });
        if (!candidat) {
            return res.status(404).send("Candidat non trouvé");
        }

        // Mettre à jour le nombre de votes du candidat
        await db.collection("Candidat").updateOne(
            { _id: new ObjectId(candidatId) },
            { $inc: { votes: 1 } }
        );

        res.send("Vote enregistré avec succès !");
    } catch (error) {
        res.status(500).send('Erreur lors de l\'enregistrement du vote');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('jwt');  
    res.redirect('/login');
});

server.listen(4000, () => {
    console.log("Server running on port 4000");
});