const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const session = require("express-session");
const http = require("http"); 
const authenticateJWT = require("./middlewares/auth.js");
const auth = require("./routes/auth.js");
const cookieParser = require('cookie-parser');


const socketIo = require('socket.io');

const app = express();
app.set("view engine", "ejs");
app.use(express.static('public'));
const server = http.createServer(app);






// Initialiser Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",  
        methods: ["GET", "POST"]
    }
});




const multer = require('multer');
const path = require('path');

// stockage des fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});

// Créer une instance de multer avec les options de stockage
const upload = multer({ storage: storage });

app.use('/uploads', express.static('uploads'));

//connexion a mongodb
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'db_elections';
let db;
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'm$89544shhkdodp@komdled',
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

app.get("/register",async(req,res)=>{
    res.render("view_signup");
})



app.use('/profile/uploads', express.static(path.join(__dirname, 'uploads')));


 // login
app.get("/login", (req, res) => {
    res.render("login"); 
}
);

// get candidats
app.get('/candidats',authenticateJWT,async(req,res)=>{
    const userId = req.session.userId;
    const userVote = await Vote.findOne({ userId });
    const candidats =await db.collection('Candidat').find().toArray();
    console.log(candidats);
    res.render('view_candidat',{candidats, hasVoted: !!userVote });
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

        const utilisateurs = await db.collection("Utilisateurs")
        .find({ _id: { $in: userIds } })
        .toArray();

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

// consulter le profil de l'utilisateur
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
                { nom_candidat: { $regex: searchQuery, $options: "i" } }, 
                { parti: { $regex: searchQuery, $options: "i" } }         
                       ]
        }
        : {};
        const candidats = await db.collection("Candidat").find(filter).toArray();
      res.render('view_profile', { user, candidats, searchQuery });
    } catch (err) {
      console.error("Erreur lors de la récupération du profil :", err);
      res.status(500).send("Erreur serveur.");
  }
});

//procéder au vote
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

  
     
      const utilisateurs = await db.collection("Utilisateurs")
        .find({ _id: { $in: userIds } })
        .toArray();
        const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId) });
   
      const commentairesAvecUtilisateurs = commentaires.map(commentaire => {
        const utilisateur = utilisateurs.find(user => user._id.toString() === commentaire.userId.toString());
        return {
            ...commentaire,
            userDetails: utilisateur ? { nom_user: utilisateur.nom_user, prenom_user: utilisateur.prenom_user } : null,
        };
        });
   
     
      await db.collection("Votes").insertOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });
      if (voteExist) {
        return res.render('view_candidat_profile', { 
            candidat, 
            user, 
            commentaires:commentairesAvecUtilisateurs,
      hasVoted: true,
            alertMessage: "Vous avez déjà voté pour un candidat. Vous ne pouvez pas voter à nouveau." 
        });
    }
 
  
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

    db.collection("Candidat")
        .find()
        .toArray()
        .then((candidats) => {
            socket.emit("resultats", candidats);
        })
        .catch((error) => console.error("Erreur lors de la récupération des candidats :", error));

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

        res.redirect(`/profile/${userId}/favoris`);
    } catch (err) {
        console.error("Erreur lors de la mise à jour des favoris :", err);
        res.status(500).send("Erreur serveur.");
    }
});



  
//liste des favoris
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

        const favoris = await db.collection("Candidat")
            .find({ _id: { $in: user.favoris.map(id => new ObjectId(id)) } })
            .toArray();

        res.render('view_favoris', { favoris ,user});
    } catch (err) {
        console.error("Erreur lors de la récupération des favoris :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// afficher le formulaire de modification du profil
app.get('/edit-profile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).send("Utilisateur non trouvé");
        }

      res.render('view_edit_profile', { user });
    } catch (err) {
        console.error("Erreur lors de l'affichage du profil :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// mettre à jour le profil
app.post('/profile/update/:id', upload.single('photo'), async (req, res) => {
    try {
        const userId = req.params.id;

        let updatedPhoto = req.body.photo;
        if (req.file) {
            updatedPhoto = `/uploads/${req.file.filename}`; 
        }

        const updatedData = {
            nom_user: req.body.nom_user,
            prenom_user: req.body.prenom_user,
            age: req.body.age,
            photo: updatedPhoto, 
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

        res.redirect(`/profile/${userId}`);
    } catch (err) {
        console.error("Erreur lors de la mise à jour du profil :", err);
        res.status(500).send("Erreur serveur.");
    }
});


app.post('/update/:candidate', async (req, res) => {
    const candidateName = req.params.candidate;
    const candidate = await Result.findOne({ candidate: candidateName });
    if (candidate) {
      candidate.votes += 1;
      await candidate.save();
      io.emit('resultsUpdated'); 
      res.send('Mise à jour réussie');
    } else {
      res.status(404).send('Candidat non trouvé');
    }
  });

//ajouter un commentaire
app.post('/comment/:id', async (req, res) => {
    try {
        const candidatId = req.params.id; 
        const userId = req.session.userId; 
        const contenue= req.body.contenue; 

        if (!contenue) {
            return res.status(400).json({ error: "Contenu, userId ou candidatId manquant" });
        }

        const newComment = {
            contenue: contenue,
            date_ajout: new Date(), 
            nb_likes: 0, 
            nb_dislikes: 0, 
            userId: userId,
            candidatId: candidatId
        };

        const commentsCollection = db.collection('Commentaire');
        const result = await commentsCollection.insertOne(newComment);
        return res.redirect(`/candidat/${candidatId}`);
    } catch (err) {
        return res.status(500).json({
            error: "Erreur lors de l'ajout du commentaire",
            details: err.message
        });
    }
});




server.listen(4000, () => {
    console.log("Server running on port 4000");
});