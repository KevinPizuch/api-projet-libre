const express = require("express");
const router = express.Router();

router.get("/", (req,res) => {
	res.send({ response: "Alive" }).status(200);
});

module.exports = router;

//end
