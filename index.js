var express = require("express");
var ejs = require('ejs');
var app = express();
var path = require('path');
var request = require('request');
var async = require('async');
var mongoose = require('mongoose');
var bodyparser = require('body-parser');
var cors = require('cors');
var nodemailer = require('nodemailer');

var path = require('path');
var multer = require('multer');
var cloudinary = require('cloudinary');
var fs = require('fs');
var PDFDocument = require('pdfkit');

//adding middleware
app.use(cors());
app.use(bodyparser.json());

var MONGODB_URI = "mongodb://neerajnegi:yeschidori@ds153778.mlab.com:53778/blog_it";
//connect to MongoDB
mongoose.connect(MONGODB_URI);
// on successful connection
mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB @ 27017');
});
//on connection error
mongoose.connection.on('error', (err) => {
    if (err) {
        console.log('Error in DB connection: ' + err);
    }
});

cloudinary.config({
    cloud_name: 'neerajnegi174',
    api_key: '682277874687992',
    api_secret: '7-ofOlsQYFdGGEH8zM99p8PVvWM'
});


//function to create pdf
var createPdf = function(name, vehicle_num, fileName, email) {
    console.log("\ncreating pdf\n");
    var pdf = new PDFDocument({
        size: 'LEGAL', // See other page sizes here: https://github.com/devongovett/pdfkit/blob/d95b826475dd325fb29ef007a9c1bf7a527e9808/lib/page.coffee#L69
        info: {
            Title: 'Challan ',
            Author: 'Uttarakhand Police',
        }
    });

    let fname = fileName + ".pdf";

    // Write stuff into PDF
    var title = 'E-Challan from Uttarakhand Police';
    var fine = '2000 ruppes';
    pdf.fillColor('blue')
    pdf.font('fonts/Xerox Sans Serif Wide.ttf')
        .fontSize(20)
        .text(title + "\n\n", {
            align: 'center'
        })
        .fillColor('black')
    pdf.fontSize(14)
        .text('Name - ' + name + '\n\nVehicle num - ' + vehicle_num + '\n\nFine to be paid ' + fine, {
            align: 'left'
        })
    pdf.fontSize(7)
        .fillColor('red')
        .text('\n\nNote: Please pay your challan in next 15 days otherwise your vehicle can be siezed');
    // Stream contents to a file
    pdf.pipe(
            //fs.createWriteStream('./file.pdf')
            fs.createWriteStream(fname)
        )
        .on('finish', function() {
            console.log('PDF closed');
        });

    // Close PDF and write file.
    pdf.end();

    nodemailer.createTestAccount((err, account) => {
        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            //service: "Gmail",
            host: 'smtp.gmail.com',
            port: '587',
            secure: false,
            auth: {
                user: 'teampetabyte@gmail.com', // generated ethereal user
                pass: 'zen@1234' // generated ethereal password
            }
        });
        var date = Date.now();
        // setup email data with unicode symbols
        let mailOptions = {
            from: '"Team PetaByte" <teampetabyte@gmail.com>', // sender address
            to: email, // list of receivers
            subject: 'Over Speeding Ticket', // Subject line
            text: 'Hello, ' + name + ' this is your traffic ticket.', // plain text body
            attachments: [{
                path: fname
            }]
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            // Preview only available when sending through an Ethereal account
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

            // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
            // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
        });
    });

}

//api key for openalpr
var api_key = "34f815360d88957";
//setting view engine
app.set('view engine', 'ejs');

//static images to send for ocr api
app.use(express.static('uploads'));

//multer storage
var uploadedImageName;
var storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './uploads')
    },
    filename: function(req, file, callback) {
        console.log(file)
        callback(null, uploadedImageName = file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});

//get api to get upload form 
app.get('/', function(req, res) {
    res.render('index');
});

//api call 
var result;
var platenumber;

//post api to save image locally
app.post('/', function(req, res) {
    var upload = multer({
        storage: storage
    }).single('userFile')
    upload(req, res, function(err) {

        //upload images to cloudinary
        async.waterfall([
                function firstStep(done) {
                    //uploading image to cloudinary
                    console.log("First step called");
                    uploadedImageName = __dirname + "\\uploads\\" + uploadedImageName;

                    cloudinary.uploader.upload(uploadedImageName, function(res) {
                        //console.log(res);
                        var image_url = res.secure_url;
                        console.log(image_url);
                        done(null, image_url);
                    });
                },
                function secondStep(image_url, done) {
                    //get licence plate number
                    console.log(image_url);
                    console.log("Second step called");
                    var secret_key = "sk_d9f9bc94a9b2250f1475424d";
                    var meta = "&recognize_vehicle=0&country=in&return_image=0&topn=10";
                    var url = "https://api.openalpr.com/v2/recognize_url?image_url=" + image_url + "&secret_key=" + secret_key + meta;

                    request.post(url, function(err, resp, body) {
                        if (err) {
                            console.log(err);
                        } else if(resp && resp.statuscode == 200){
                            result = JSON.parse(body);
                            console.log(result.results["0"].plate);
                            platenumber = result.results["0"].plate;
                            //res.end('File is uploaded ' + platenumber);

                            PlateNumber.findOne({
                                plateNumber: platenumber
                            }, function(err, plate) {
                                console.log(plate);
                                if (plate === null) {
                                    console.log("No details found in Database.");
                                    return res.status(400).send({
                                        message: "No details found in Database."
                                    });
                                } else {
                                    console.log("Details found!");
                                    var fname = uploadedImageName;
                                    console.log(uploadedImageName);
                                    fname = fname.substring(0, fname.length - 5);
                                    console.log("\nCalling creatPdf\n");
                                    createPdf(plate.owner, plate.plateNumber, fname, plate.email);
                                    /*return res.status(201).send({
                                        message: "Details found.",
                                        plateDetails: plate
                                    });*/
                                    fname = fname + '.pdf';
                                    res.render('success', {email: plate.email, number: plate.plateNumber, pdf: fname});
                                }
                            });

                        }
                    });
                }
            ],
            function(err) {
                if (err)
                    console.log("Error in async: " + err);
            });
    });

});

const PlateNumber = require('./models/plateNumber');
app.get('/setPlateDetail',(req,res)=>{
	res.render('addPlateDetails');
});

app.post('/setPlateDetail', (req, res) => {
    console.log(req.body.plateNumber);
    let newPlate = new PlateNumber();
    newPlate.plateNumber = req.body.plateNumber;
    newPlate.email = req.body.email;
    newPlate.owner = req.body.owner;

    newPlate.save((err, PlateNumber) => {
        if (err) {
            console.log(err);
            return res.status(400).send({
                message: "Failed to add license plate details."
            })
        } else {
            return res.status(201).send({
                message: "License Plate details added successfully",
                PlateDetails: PlateNumber
            })
        }
    });
});

app.post('/getPlateDetail', (req, res) => {
    PlateNumber.findOne({
        plateNumber: req.body.plateNumber
    }, function(err, plateNumber) {
        console.log(plateNumber);
        if (plateNumber === null) {
            console.log("No details found in Database.");
            return res.status(400).send({
                message: "No details found in Database."
            });
        } else {
            console.log("Details found!");
            return res.status(201).send({
                message: "Details found.",
                plateDetails: plateNumber
            });
        }
    });
});

//server
var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log('Node.js listening on port ' + port);
    console.log("Directory: " + __dirname);
});