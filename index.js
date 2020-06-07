const express = require('express');
const cors = require('cors');
const monk = require('monk');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.urlencoded({
    extended: false
 }));
 
 app.use(bodyParser.json());

app.use(express.static('client'));

const URI = "mongodb://mandalinvodka:mandalinvodka1@ds233238.mlab.com:33238/heroku_vrx1472g";
const db = monk(URI);
const mandalins = db.get('mandalins');
const filter = new Filter();

app.enable('trust proxy');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'hello'
  });
});

app.get('/mandalins', (req, res, next) => {
  mandalins
    .find()
    .then(mandalins => {
      res.json(mandalins);
    }).catch(next);
});

app.get('/v2/mandalins', (req, res, next) => {
  // let skip = Number(req.query.skip) || 0;
  // let limit = Number(req.query.limit) || 10;
  let { skip = 0, limit = 5, sort = 'desc' } = req.query;
  skip = parseInt(skip) || 0;
  limit = parseInt(limit) || 5;

  skip = skip < 0 ? 0 : skip;
  limit = Math.min(50, Math.max(1, limit));

  Promise.all([
    mandalins
      .count(),
    mandalins
      .find({}, {
        skip,
        limit,
        sort: {
          created: sort === 'desc' ? -1 : 1
        }
      })
  ])
    .then(([ total, mandalins ]) => {
      res.json({
        mandalins,
        meta: {
          total,
          skip,
          limit,
          has_more: total - (skip + limit) > 0,
        }
      });
    }).catch(next);
});

function isValidMandalin(mandalin) {
  return mandalin.name && mandalin.name.toString().trim() !== '' && mandalin.name.toString().trim().length <= 50 &&
    mandalin.content && mandalin.content.toString().trim() !== '' && mandalin.content.toString().trim().length <= 300;
}

app.use(rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1
}));

const createMandalin = (req, res, next) => {
  if (isValidMandalin(req.body)) {
    const mandalin = {
      name: filter.clean(req.body.name.toString().trim()),
      content: filter.clean(req.body.content.toString().trim()),
      created: new Date()
    };

    mandalins
      .insert(mandalin)
      .then(createMandalin => {
        res.json(createMandalin);
      }).catch(next);
  } else {
    res.status(422);
    res.json({
      message: 'Ne çok uzun olmalı yaşadıkların ne çok kısa...'
    });
  }
};

app.post('/mandalins', createMandalin);
app.post('/v2/mandalins', createMandalin);

app.use((error, req, res, next) => {
  res.status(500);
  res.json({
    message: error.message
  });
});

app.listen(process.env.PORT, () => {
  console.log('Listening');
});