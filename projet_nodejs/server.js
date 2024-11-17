const { MongoClient,ObjectId  } = require("mongodb");
const express=require("express")
const app = express();
const session = require("express-session");
app.set("view engine","ejs");
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

  
      const voteExist = await db.collection("Votes").findOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

      if (voteExist) {
          return res.render('view_candidat_profile', { 
              candidat, 
              user, 
              hasVoted: true, 
              alertMessage: "Vous avez déjà voté pour ce candidat." // Message d'alerte
          });
      }

      await db.collection("Votes").insertOne({ userId: new ObjectId(userId), candidatId: new ObjectId(candidatId) });

      
      await db.collection("Candidat").updateOne(
          { _id: new ObjectId(candidatId) },
          { $inc: { nbVotes: 1 } }
      );

      res.redirect(`/candidat/${candidatId}`);
  } catch (err) {
      console.error("Erreur lors du vote :", err);
      res.status(500).send("Erreur serveur.");
  }
});


app.listen(4000, () => {
  console.log("Server running on port 4000");
});