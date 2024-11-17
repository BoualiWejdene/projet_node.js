const { MongoClient } = require("mongodb");
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
    res.redirect("/users");
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
      res.redirect("/users");
      
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

app.listen(4000)