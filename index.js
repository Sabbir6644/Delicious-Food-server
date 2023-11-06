const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: ['https://calm-narwhal-02fbf7.netlify.app', 'http://localhost:5173'],
  credentials: true
}));
// customs middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'not authorized' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'not authorized' })
    }
    req.user = decoded;
    next();
  })
}


app.use(express.json());
app.use(cookieParser());

// MongoDB

// const uri = "mongodb://127.0.0.1:27017"
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l5acpqm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const foodCollection = client.db("foods").collection("allFood");
    const bookingCollection = client.db("carDoctor").collection("booking");
    //  Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({ success: true })
    })
    app.get('/allFoods', async (req, res) => {
      const page = parseInt(req?.query.page)
      const size = parseInt(req?.query.size)
      const result = await foodCollection.find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    })
    // Pagination
    app.get('/allFoodsCount', async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount();
      res.send({ count })
    })

    // Pagination



    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: { title: 1, img: 1, service_id: 1, price: 1, },
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result)
    })
    // order booking
    app.post('/booking', async (req, res) => {
      const order = req.body
      const result = await bookingCollection.insertOne(order);
      res.send(result)
    });
    app.get('/booking', verifyToken, async (req, res) => {
      // console.log(req.query.email);
      // console.log('user in valid token', req.user);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })
    // Order cancle
    app.delete('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result)

    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('delicious food server is running')
})
app.listen(port, () => {
  console.log(`delicious food  server is running on port ${port}`);
})