const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const Grid = require('gridfs-stream');
const GridFsStorage = require('multer-gridfs-storage');
const methodOverride = require('method-override');

const app = express();

//Middlewre
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

//Mongo URI
const mongoURI = 'mongodb://misoadmin:misoadmin1@ds125673.mlab.com:25673/misodb';

//Create mongo connection
const conn = mongoose.createConnection(mongoURI, { useNewUrlParser: true });

//Init gfs
let gfs;

conn.once('open', function() {
  console.log('DB CONNECTED');
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

//Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: file.originalname,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });

// @route GET /
// @desc Loads form
app.get('/', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if(!files || files.length === 0) {
      res.render('index', { files: false });
    } else {
      files.map(file => {
        if(file.contentType === 'video/mp4') {
          file.isVideo = true;
        } else {
          file.isVideo = false;
        }
      });
      res.render('index', { files: files });
    }
  });
});

// @route POST /Uploads
// @desc Uploads file to DB
app.post('/upload', upload.single('videofile'), (req, res) => {
  res.redirect('/');
});

// @route GET /files
// @desc Display all files in JSON
app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if(!files || files.length === 0) {
      res.render('index', { files: false });
    }
    return res.json(files);
  });
});

app.get('/player/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
      if(!file || file.length === 0) {
        return res.status(404).json({
          err: 'No file exists'
        });
      }
      if(file.contentType === 'video/mp4') {
        // Read output to browser
        const readstream = gfs.createReadStream(file.filename);
        res.set('Content-Type', file.contentType);
        return readstream.pipe(res);
      } else {
        res.status(404).json({
          err: 'Not an video'
        });
      }
  });
});

// @route GET /video/:filename
// @desc Display video file
app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: {'$regex': '.*'+req.params.filename+'.*', '$options': 'i'} }, (err, file) => {
    if(!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    return res.json(file);
  });
});

app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if(err) {
      return res.status(404).json({ err: err });
    }
    res.redirect('/');
  });
});

// @route GET /video/:filename
// @desc Display single video file
app.get('/video/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if(!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    if(file.contentType === 'video/mp4') {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an video'
      });
    }
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
