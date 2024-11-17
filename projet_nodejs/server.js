const { MongoClient,ObjectId  } = require("mongodb");
const express=require("express")
const app = express();

app.set("view engine","ejs");
//connexion a mongodb
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'db_elections';
let db;
app.use(express.urlencoded({extended:true}))
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
    const candidat = await db.collection("Candidat").findOne({ _id: new ObjectId(candidatId) });

    if (!candidat) {
      return res.status(404).send("Candidat non trouvé");
    }

    res.render('view_candidat_profile', { candidat });

  } catch (err) {
    console.error("Erreur lors de la récupération du profil du candidat :", err);
    res.status(500).send("Erreur serveur.");
  }
});

app.get('/profile/:id', async (req, res) => {
  try {
    const userId = req.params.id; // Récupère l'ID de l'utilisateur dans l'URL
    const user = await db.collection("Utilisateurs").findOne({ _id: new ObjectId(userId) });
    console.log(user)
    if (!user) {
      return res.status(404).send("Utilisateur non trouvé");
    }
    const candidats = await db.collection("Candidat").find().toArray();
    // Afficher le profil de l'utilisateur
    res.render('view_profile', { user, candidats});
  } catch (err) {
    console.error("Erreur lors de la récupération du profil :", err);
    res.status(500).send("Erreur serveur.");
  }
});
app.listen(4000)