module.exports = {
    
    getRandomWord: function() {
        const words = [
            "crotte",
            "LE CACA",
        ]
      return words[Math.floor(Math.random()*words.length)];
    }
  };