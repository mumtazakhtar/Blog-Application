//<-----------------Requiring Dependencies------------------>
const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const app = express();

//<-------connecting to postgres database--------->
const sequelize = new Sequelize('blogapp', process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
    host: 'localhost',
    dialect: 'postgres',
    storage: './session.postgres'
})

app.use(express.static('../public'))
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
app.set('views', './views')

//<---------Session Store---------->
app.use(session({
    store: new SequelizeStore({
        db: sequelize,
        checkExpirationInteral: 15 * 60 * 1000,
        expiration: 24 * 60 * 60 * 1000
    }),
    secret: "safe",
    saveUninitialized: true,
    resave: false
}))


//<--------Multer----------->
const multer  = require('multer')
const myStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '../public/images/user-images')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now())
    }
})
const upload = multer({ storage: myStorage });


//<----------Defining models----------->
const User = sequelize.define('users', {
    name: Sequelize.STRING,
    email: Sequelize.STRING,
    password: Sequelize.STRING,
    profilePicture: Sequelize.STRING 
}, { timestamps: false })

const Post = sequelize.define('posts',{
    posts: Sequelize.STRING
})

const Comment = sequelize.define('comments',{
    comments: Sequelize.STRING
})

//<------RELATION BETWEEN TABLES--------->
User.hasMany(Post)
Post.hasMany(Comment)
Post.belongsTo(User)
Comment.belongsTo(Post)
User.hasMany(Comment)

//<<------------------------Routes------------------------->>

// Default index page
app.get('/', function(req, res) {
    let user = req.session.user
    res.render("index.pug", {message: req.query.message })
})

// <----------Create new user (Signup)----------->
app.post('/users' , upload.single('profileImage'), (req, res, next)=> {

    let path = req.file.path.replace('public', '')
    let Name = req.body.name
    let Email = req.body.email
    let Password = req.body.password

    console.log(`input details--> ${Name}-->${Email}-->${Password}`)

    User.create({
        name: Name,
        email: Email,
        password: Password,
        profilePicture: path
    }).then(function(user) {
        req.session.user = user;
        res.redirect('/?message=' + encodeURIComponent("you are succesfully registered"))

    })
})

//<----------------(GET) sign up page------------->
app.get('/users/new', function(req, res) {
    res.render("signup.pug")
})

//<----------------(POST) login---------------->
app.post('/login', function(req, res) {
    let name = req.body.name;
    let password = req.body.password;
    console.log(`input details-->${name}-->${password}`)

    User.findOne({
        where: {
            name: name
        }

    }).then(function(details) {

        if (details !== null && password === details.password) {
            req.session.user = details;
            
                res.redirect('/profile')
            }
         else {
            res.redirect('/?message='+ encodeURIComponent("Invalid Email or Password"))
        } 

    })

})


//<----------render profile page---------->
app.get('/profile', function(req, res) {
    const user = req.session.user
    if (user === undefined) {
        res.redirect('/?message=' + encodeURIComponent("please login to view your profile"))

    } else {
        User.findAll()
            .then(allUsers => {

                User.findOne({
                    where: {
                        name: user.name
                    }

                }).then(function(details) {
                    Post.findAll({
                        where: {
                            userId: details.id
                        },
                        include: [{
                            model: Comment
                        }]
                    }).then(posts => {

                        console.log(`all posts-------->${JSON.stringify(posts)}`)
                        posts = posts.map(data => {
                            var columns = data.dataValues;
                            return {
                                id: columns.id,
                                posts: columns.posts,
                                comments: columns.comments
                            }
                        })

                        res.render('profile', { user: details, posts: posts, allUsers: allUsers })
                    })
                })

            })
    }

})


//<-------Posts(post)------------>
app.post('/posts', function(req, res) {
    let post = req.body.post;
    const user = req.session.user
    User.findOne({
        where: {
            name: user.name
        }
    }).then(user => {
        user.createPost({
            posts: post
        })
        res.redirect('/profile')
    });

});

//<-------To see all posts--------->
app.get('/allposts', function(req, res) {
    const user = req.session.user;
    if (user === undefined) {
        res.redirect('/?message=' + encodeURIComponent("please login to view all posts"))

    } else {

        User.findAll()

        .then(users=>{

            Post.findAll({
            include: [
                { model: Comment },
                {model: User}
            ]
        }).then(posts => {
            
                console.log(`working -----------> ${JSON.stringify(posts)}`);
                console.log(`comments---------->${JSON.stringify(posts[0].comments)}`);
            posts = posts.map(allData => {
                var columns = allData.dataValues;
                return {
                    id: columns.id,
                    posts: columns.posts,
                    userId: columns.userId,
                    comments: columns.comments
                }
            })
            

              res.render('allposts', {
                posts: posts,
                users: users,
                name: user
            });

        })
        

    })
            

    }

});



//<----------write comment(POST)-------------->>
app.post('/comment/:id',function(req,res){
    let reqparams = req.params;
    let comment = req.body.comment;
    const id = req.session.user.id
    Post.findOne({
        where:{
            id: reqparams.id
        }
    }).then(post=>{
        post.createComment({
            comments: comment,
            userId: id
        })
        res.redirect('/allposts')
    });
})


//<-----------specific post----------->
app.get('/selected', (req,res)=>{
    let input = req.query.selected;
    console.log(`----->input ${input}`)
    User.findAll()
    .then(allUsers=>{
        User.findOne({
        where: {
            id: input
        }

    }).then(function(details) {
        Post.findAll({
            where: {
                userId: details.id
            },
            include: [{
                model: Comment
            }]
        }).then(posts => {

            console.log(`all posts-------->${JSON.stringify(posts)}`)
            posts = posts.map(data => {
                var columns = data.dataValues;
                return {
                    id: columns.id,
                    posts: columns.posts,
                    comments: columns.comments
                }
            })

        res.render('newProfile',{allUsers:allUsers ,user: details, posts: posts});
    })
    })

    })
})


//<------------logout------------>
app.get('/logout', function(req, res) {
    req.session.destroy(function(error) {
        if (error) {
            throw error;
        }
        res.redirect('/')
    })
})



sequelize.sync()

//<---PORT--->
app.listen(4000, function() {
    console.log("app is listening at port 4000")
})