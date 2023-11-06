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
  origin: ['https://cosmic-biscochitos-7aa7f1.netlify.app', 'http://localhost:5173', 'http://localhost:4173'],
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
    const orderCollection = client.db("foods").collection("order");
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
// store order details
app.post('/order', async (req, res) => {
  const order = req.body
  const result = await orderCollection.insertOne(order);
  res.send(result)
});


    app.get('/singleFood/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodCollection.findOne(query);
      res.send(result)
    })
    // new order
    app.post('/createOrder', async (req, res) => {
      const orderData = req.body;    
      try {
        const query = { _id: new ObjectId(orderData.id) }
        // Find the product in the products collection
        const food = await foodCollection.findOne(query);
    
        if (!food) {
          return res.status(404).send({ error: 'Product not found' });
        }
        if(food?.made_by_email===orderData?.buyerEmail) {
          return res.send({ error: 'You have added this product, so you can not buy this item' });
        }
        // Check if there is enough stock
        if (food.quantity < orderData.quantity) {
          return res.status(400).send({ error: 'Not enough stock available' });
        }   
        // Calculate the new total sell value
        const newTotalSell = food.totalSell ? food.totalSell + orderData.quantity : orderData.quantity;
    
        // Create a new order
        const order = {
          foodName: orderData?.foodName,
          quantity: orderData?.quantity,
          buyerName: orderData?.buyerName,
          price: orderData?.price,
          buyerEmail: orderData?.buyerEmail,
          buyingDate: orderData?.buyingDate,
          food_image: orderData?.food_image,
        };
    
        // Save the order to the orders collection
        const result = await orderCollection.insertOne(order);
        console.log(result);
        if (result.acknowledged) {
          // Update the product quantity and total sell
          await foodCollection.updateOne(
            { _id: new ObjectId(orderData.id) },
            {
              $inc: { quantity: -orderData.quantity },
              $set: { totalSell: newTotalSell }
            }
          );
    
          res.send({ message: 'Order created successfully' });
        } else {
          res.status(500).send({ error: 'Failed to create order' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal server error' });
      }
    });
    // top selling food
    app.get('/topSellingFood', async (req, res) => {
      try {
        const topSellingFood = await foodCollection.find()
          .sort({ totalSell: -1 }) 
          .limit(6) 
          .toArray();
    
        res.send(topSellingFood);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    
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