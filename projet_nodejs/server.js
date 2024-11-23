const { MongoClient,ObjectId  } = require("mongodb");
const express=require("express")
const app = express();
const session = require("express-session");
app.set("view engine","ejs");
const http = require("http"); // Importer le module HTTP


const socketIo = require('socket.io');
// Créer un serveur HTTP
const server = http.createServer(app);

// Créer une instance de socket.io et la lier au serveur HTTP
const io = socketIo(server);

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

MongoClient.connect(url)
.then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
})
.catch(err => {console.error(error)});


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
app.get("/signup",async(req,res)=>{
    res.render("view_signup");
})

// ajouter user
app.post("/users" , async(req,res)=>{
    const newUser = {nom_user:req.body.nom_user ,prenom_user:req.body.prenom_user ,age:req.body.age,
        photo:req.body.photo,region:req.body.region,email:req.body.email,mot_de_passe:req.body.mot_de_passe,
        genre:req.body.genre,ResiderEnTunisie:req.body.ResiderEnTunisie}
    await db.collection("Utilisateurs").insertOne(newUser);
    res.redirect("/login");
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

app.post("/login", async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

      const user = await db.collection("Utilisateurs").findOne({email});
      if (user==null) {
        return res.status(400).send("Utilisateur non trouvé");
      }
        if (user.mot_de_passe !== mot_de_passe) {
        return res.status(400).send("Mot de passe incorrect");
      }
    // Stocker l'ID utilisateur dans la session
    req.session.userId = user._id;

    res.redirect(`/profile/${user._id}`);

      
    } catch (err) {
      console.error("Erreur lors de la connexion :", err);
      res.status(500).send("Erreur serveur.");
    }
  });

// get candidats
app.get('/candidats',async(req,res)=>{
    const candidats =await db.collection('Candidat').find().toArray();
    console.log(candidats);
    res.render('view_candidat',{candidats});
})
// get candidat by id
app.get('/candidat/:id', async (req, res) => {
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


      const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

      res.render('view_candidat_profile', { 
          candidat, 
          user, 
          hasVoted: !!voteExist, 
          alertMessage: null 
      });
  } catch (err) {
      console.error("Erreur lors de la récupération du profil du candidat :", err);
      res.status(500).send("Erreur serveur.");
  }
});


app.get('/profile/:id', async (req, res) => {
  try {
      const userId = req.params.id;
      const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });

      if (!user) {
          return res.status(404).send("Utilisateur non trouvé");
      }

      const candidats = await db.collection("Candidat").find().toArray();
      res.render('view_profile', { user, candidats });
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
  
      const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).send("Utilisateur non trouvé");
      }
  
      // Vérifier si l'utilisateur a déjà voté
      const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });
  
      if (voteExist) {
        return res.render('view_candidat_profile', { 
          candidat, 
          user, 
          hasVoted: true, 
          alertMessage: "Vous avez déjà voté pour ce candidat." 
        });
      }
  
      // Enregistrer le vote
      await db.collection("Votes").insertOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });
  
      // Mettre à jour le nombre de votes du candidat
      await db.collection("Candidat").updateOne(
        { _id: new ObjectId(candidatId) },
        { $inc: { nbVotes: 1 } }
      );
  
      // Émettre les résultats en temps réel
      const candidats = await db.collection("Candidat").find().toArray();
      io.emit('resultats', candidats);  // Envoie des résultats à tous les clients
  
      res.redirect(`/candidat/${candidatId}`);
    } catch (err) {
      console.error("Erreur lors du vote :", err);
      res.status(500).send("Erreur serveur.");
    }
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

app.listen(4000, () => {
  console.log("Server running on port 4000");
});