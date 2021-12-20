const fs = require('fs')
const https = require('https')
const cookieParser = require("cookie-parser")
const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ObjectId } = require("mongodb")
const session = require('express-session')
var uuid = require('uuid')

const port = 4430

const privateKey = fs.readFileSync('sslcert/selfsigned.key', 'utf8')
const certificate = fs.readFileSync('sslcert/selfsigned.crt', 'utf8')
const credentials = {key: privateKey, cert: certificate}

const client = new MongoClient("mongodb+srv://user:user@cluster0.5ksjv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

client.connect((err, connection) => {
  // Log database connection
  if (err || !connection)
    console.error(err)
  else
    console.log("Successfully connected to MongoDB")

  // Get database collections
  let db = client.db('bookshop')
  let collections = {
    users: db.collection('users')
  }

  app.use(express.static(path.join(__dirname, 'client/build')))

  // Enable JSON and CORS middlewares
  app.use(express.json())
  app.use(cors({ origin: true, credentials: true }))

  // Enable session management
  app.use(session({
    name: 'bs_session',
    secret: 'keyboard cat',
    genid: (req) => uuid.v4(),
    saveUninitialized: false,
    resave: false,
    cookie: {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    }
  }))

  app.use(cookieParser())

  // Log every request
  app.use((req, res, next) => {
    console.log('\n-----------------------------------')
    console.log(req.session)
    console.log('Time:', Date.now())
    next()
  })

  // Register new user
  app.post('/signUp', (req, res) => {
    console.debug(`(/signUp): ${JSON.stringify(req.body)}`)
    const { username, email, password } = req.body

    // TODO: check if such user already exists

    collections.users.insertOne({
      username: username,
      email: email,
      password: password
    }).then(result => {
      console.log(result)
    }).catch(e => console.error(e))

    res.end(JSON.stringify({
      status: "ok"
    }))
  })

  // Sign in
  app.post('/signIn', (req, res) => {
    console.debug(`(/signIn): ${JSON.stringify(req.body)}`)
    const { email, password } = req.body

    collections.users.findOne({ email: email, password: password })
    .then(result => {
      console.debug('(/signIn): success')

      // Set up session
      req.session.signedIn = true
      req.session.email = result.email

      console.log('===================================================================\n')
      console.log(req.session)

      res.json(JSON.stringify({
        success: true
      }))
    })
    .catch(e => {
      console.debug('(/signIn): exception')

      res.json(JSON.stringify({
        success: false
      }))
    })
  })

  // Get user info
  // Allowed for client when user is signed in
  // and client has established session
  app.get('/userInfo', (req, res) => {
    console.debug(`(/userInfo): ${JSON.stringify(req.session)}`)

    if (!req.session.email)
      res.json(JSON.stringify({ success: false }))

    collections.users.findOne({ email: req.session.email })
    .then(result => {
      console.debug('(/userInfo): success')
      console.log(req.session)
      console.log(result)

      res.json(JSON.stringify({
        success: true,
        username: result.username,
        email: result.email
      }))
    })
    .catch(e => {
      console.debug('(/userInfo): exception')
    })
  })

  // Handles any requests that don't match the ones above
  app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname + '/client/build/index.html'))
  })

  let httpsServer = https.createServer(credentials, app)

  // Start server
  httpsServer.listen(port, () => {
    console.log(`Server listening at https://localhost:${port}`)
  });
})
