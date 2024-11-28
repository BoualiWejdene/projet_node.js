const JWT_SECRET = 's147Bipmf78455wkjjhhghghgggfstyftpm';
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token) {
        return res.status(403).send("Accès refusé. Vous devez vous connecter.");
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send("Token invalide.");
        }

        req.user = user;
        next();
    });
};

module.exports = authenticateJWT;
