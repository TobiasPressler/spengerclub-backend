const express = require('express');
const router = express.Router();
const wordpress = require('wordpress');

router.get("/spglogin",(req,res)=>{
    const client = wordpress.createClient({
        url: "intranet.spengergass.eat",
        username: req.body.user,
        password: req.body.pass
    });

    client.get(function( error, posts ) {
        res.json({status:(error===undefined)});
    });
});

module.exports = router;