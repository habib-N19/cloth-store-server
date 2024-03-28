const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors(
    {
        origin: 'http://localhost:3000',
        credentials: true,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],

    },
    // {
    //     origin: 'https://healthhub-991c2.web.app',
    //     credentials: true,
    //     methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    // }
));
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        // Connect to MongoDB
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db('clothing-store-nextjs');
        const collection = db.collection('users');
        const productsCollection = db.collection('products');

        // User Registration
        app.post('/api/v1/register', async (req, res) => {
            const { name, email, password } = req.body;
            console.log(req.body);

            // Check if email already exists
            const existingUser = await collection.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists'
                });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert user into the database
            await collection.insertOne({ name, email, password: hashedPassword });

            res.status(201).json({
                success: true,
                message: 'User registered successfully'
            });
        });

        // User Login
        app.post('/api/v1/login', async (req, res) => {
            const { email, password } = req.body;
            console.log(req.body);

            // Find user by email
            const user = await collection.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Compare hashed password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Generate JWT token
            const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.EXPIRES_IN });

            res.json({
                success: true,
                message: 'Login successful',
                token
            });
        });


        // ==============================================================
        // WRITE YOUR CODE HERE
        // ==============================================================



        // get all products
        app.get('/api/v1/products', async (req, res) => {
            const products = await productsCollection.find().toArray();
            res.json(products);
        });

        // get all products by category
        app.get('/api/v1/products/category/:category', async (req, res) => {
            const category = req.params.category;
            const products = await productsCollection.find({ category }).toArray();
            res.json(products);
        }
        );
        //get latest 6 products

        app.get('/api/v1/products/latest', async (req, res) => {
            try {
                const products = await productsCollection.find().sort({ _id: -1 }).limit(6).toArray();
                res.json(products);
            } catch (error) {
                console.error("Error fetching latest products:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        // get flash sale 5 products
        app.get('/api/v1/products/flash-sale', async (req, res) => {
            try {
                const products = await productsCollection.find({ flash_sale: true }).limit(5).toArray();
                res.json(products);
            } catch (error) {
                console.error("Error fetching flash sale products:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        // get all flash sale products
        app.get('/api/v1/products/flash-sale/all', async (req, res) => {
            try {
                const products = await productsCollection.find({ flash_sale: true }).toArray();
                res.json(products);
            } catch (error) {
                console.error("Error fetching flash sale products:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });

        // get top rated products
        app.get('/api/v1/products/top-rated', async (req, res) => {
            const products = await productsCollection.find({ 'ratings.rating': { $gte: 4 } }).sort({ 'ratings.rating': -1 }).limit(6).toArray();
            res.json(products);
        });
        // get top 6 products categories 
        app.get('/api/v1/products/categories', async (req, res) => {
            const categories = await productsCollection.distinct('category');
            res.json(categories);
        });
        // get top 6 category
        app.get('/api/v1/products/categories/top', async (req, res) => {
            const categories = await productsCollection.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 6 }
            ]).toArray();
            res.json(categories);
        });
        // get products by category query 
        app.get('/api/v1/products/category', async (req, res) => {
            const category = req.query.category;
            const products = await productsCollection.find({ category: category }).toArray();
            res.json(products);
        });

        // get products by search query
        app.get('/api/v1/products/search/:query', async (req, res) => {
            const query = req.params.query;
            const products = await productsCollection.find({ $text: { $search: query } }).toArray();
            res.json(products);
        });
        // get products by price range , brands, category, rating from the query
        app.get('/api/v1/products/filter', async (req, res) => {
            const query = req.query;
            const filter = {};
            if (query.category) {
                filter.category = query.category;
            }
            if (query.brand) {
                filter.brand = query.brand;
            }
            if (query.rating) {
                filter.rating = { $gte: parseInt(query.rating) };
            }
            if (query.price) {
                const [min, max] = query.price.split('-');
                filter.price = { $gte: parseInt(min), $lte: parseInt(max) };
            }
            const products = await productsCollection.find(filter).toArray();
            res.json(products);
        });
        // get a single product by id
        app.get('/api/v1/products/:id', async (req, res) => {
            const id = req.params.id;
            const product = await productsCollection.findOne({ product_id: id });
            res.json(product);
        });
        // dashboard=============================
        // get specific products info for showing all products on dashboard by sorting with productId, name , img, price, rating and category

        app.get('/api/v1/dashboard/all-products', async (req, res) => {
            const products = await productsCollection.find().sort({ _id: -1 }).project({ name: 1, img: 1, price: 1, rating: 1, category: 1, images: 1 }).toArray();
            res.json(products);
        }
        );










        // Start the server
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    } finally {
    }
}

run().catch(console.dir);

// Test route
app.get('/', (req, res) => {
    const serverStatus = {
        message: 'Server is running smoothly',
        timestamp: new Date()
    };
    res.json(serverStatus);
});