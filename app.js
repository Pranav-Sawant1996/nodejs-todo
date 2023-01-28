const express= require('express')
const clc=require('cli-color')
const mongoose=require('mongoose')
const bcrypt=require('bcrypt')
const validator = require("validator");
const session= require('express-session')
const mongoDBSession= require('connect-mongodb-session')(session)

//file imports

const UserSchema=require('./UserSchema')
const { cleanUpAndValidate } = require('./utils/AuthUtils');
const isAuth = require('./middleware/authMiddleware');
const TodoModel = require('./models/TodoModel');
const rateLimiting = require('./middleware/rateLimiting');

//variables
const app= express()
const PORT=process.env.PORT || 8000
const saltround=12

//mongo db connection
const MongoURI=`mongodb+srv://pranav:mh08racing@cluster0.dsua0ay.mongodb.net/todoApp`

mongoose.set('strictQuery', false);

mongoose.connect(MongoURI,{
  useNewUrlParser: true,
    useUnifiedTopology: true,
}).then((res)=>{
     console.log(clc.yellow('connected to MongoDb'))
})
.catch((err)=>{
    console.log(clc.red(err))
})

//middleware
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set('view engine','ejs')   // to run ejs file  all the ejs files should be in views file
app.use(express.static('public'))


// session
const store = new mongoDBSession({
  uri: MongoURI,
  collection: "sessions",
});

app.use(  //middleware
  session({
    secret:'node js',
    resave:false,   // do not resave the session again and again even if the request is made again and again once the session is generated 
    saveUninitialized:false,
    store: store
  })
)



app.get('/',(req,res)=>{
    return res.send('this is todo app')
})

// get request register and login
app.get('/register',(req,res)=>{
    return res.render('register')
})

app.get('/login',(req,res)=>{
    return res.render('login')
})

// post request register and login
app.post('/register',async (req,res)=>{
//validate the data
const { name, email, password, username } = req.body;
console.log(name, email, password, username)
try {
  await cleanUpAndValidate({ name, password, username, email });
} catch (error) {
  return res.send({
    status: 402,
    error: error,
  });
} 


//hash password
// bcrypt uses md5 algorithm
const hashedPassword=await bcrypt.hash(password, saltround);

// create a user and store it in db
let user = new UserSchema({
    name: name,
    email: email,
    password: hashedPassword,
    username: username,
  });

//check weather user exists or not
let userExists

try {
  userExists= await UserSchema.findOne({email})
} catch (error) {
    return res.send({
        status: 400,
        message: "Internal server error, Please try again!",
        error: error,
      });
}
if (userExists) {
    return res.send({
      status: 403,
      message: "User already exists",
    });
  }

  try {
    const userDB= await user.save() // creates user in DB
    // console.log(userDB)
    // return res.send({
    //     status:200,
    //     message:'Registration is successfull',
    //     data:userDB
    // })
    return res.status(200).redirect('/login')   // redirected to login page after successfull registration
  } catch (error) {
    return res.send({
        status: 402,
        message:'Registration is unsuccessfull',  
        error: error,
      });
  }

    console.log(req.body)
   
})





app.post('/login',async (req,res)=>{
      //validate the data
  const { loginId, password } = req.body;
if(!loginId || !password || typeof loginId !=='string' || typeof password !=='string'){
  return res.send({
    status:400,
    message:'Invalid Data'
  })
}

let userDB
try { 
  if(validator.isEmail(loginId)){
   userDB= await UserSchema.findOne({email:loginId})
  }
  else{
    userDB=await UserSchema.findOne({username:loginId})
  }

  // if user doesnot exists
  if(!userDB){
    return res.send({
      status:401,
      message:'user not found please register first'
    })
  }

//compare the req.body.password(plain password)  with userDB.password (hashed)
const isMatch= await bcrypt.compare(password, userDB.password)

if(!isMatch){
return res.send({
  status:403,
  message:'Incorrect password',
    data:userDB
})
}


req.session.isAuth= true
req.session.user={
  username:userDB.username,
  email:userDB.email,
  userId:userDB._id
}

//final return
return res.status(200).redirect('/dashboard')
// return res.send({
//   status:200,
//   message:'Login successfull',
//   data:userDB
// })

} catch (error) {
  console.log(error)
  return res.send({
    status:400,
    message:'database error',
    error:error
  })
}

})

// app.get('/home',isAuth ,(req,res)=>{
 
//     return res.send('home page')
// })

app.get('/dashboard',isAuth,async(req,res)=>{
  let todos=[]
  const username=req.session.user.username

  try {
   todos= await TodoModel.find({username:username})
  
  } catch (error) {
    return res.send({
      status:400,
      message:'error occured',
      error:error
    })
  }

  return res.render('dashboard',{todos:todos})
})

app.post('/logout',isAuth,(req,res)=>{
console.log(req.session.destroy)
req.session.destroy((err)=>{
  if(err) throw err
  res.redirect('/login')
})
})

app.post('/logout_from_all_devices',isAuth, async (req,res)=>{
const username=req.session.user.username

//create session schema
const Schema=mongoose.Schema
const sessionSchema=new Schema({_id: String}, {strict:false})
const SessionModel = mongoose.model('session',sessionSchema)

try {
 const sessionDb=  await SessionModel.deleteMany({
    "session.user.username":username
  })
  console.log(sessionDb)
  return res.send({
    status:200,
    message:'logged out of all devices successfully'
  })

} catch (error) {
  return res.send({
    status:400,
    message:'logged out of all devices Unsuccessfully',
    error:error
  })
}
})


// todo app routes
  app.post('/create-item',isAuth, rateLimiting, async (req,res)=>{
    console.log(req.body.todo)

    const todoText= req.body.todo
    
    if(!todoText){
      res.send({
        status:400,
        message:'Missing Parameters'
      })
    }

    if(typeof todoText !== 'string'){
      res.send({
        status:400,
        message:'Invalid text'
      })
    }

    if(todoText.length > 100){
      res.send({
        status:400,
        message:'todo is too long'
      })
    }

    let todo=new TodoModel({
      todo: todoText,
      username:req.session.user.username
    })

    try {
     const todoDb= await todo.save()
     return res.send({
      status:201,
      message:'todo created successfully'
     })  
    } catch (error) {
      return res.send({
        status:400,
        message:'database error, Please try again',
        error: error
       }) 
    }

  })


  app.post('/edit-item',async (req,res)=>{
const id=req.body.id
const newData=req.body.newData

console.log(req.body)

if(!id || !newData){
  return res.send({
    status:400,
    message:'Missing Parameters'
  })
}

if(typeof newData !== 'string'){
  res.send({
    status:400,
    message:'Invalid text'
  })
}

if(newData.length > 100){
  res.send({
    status:400,
    message:'todo is too long'
  })
}

try {
  const todoDb= await TodoModel.findOneAndUpdate({_id: id}, {todo : newData})
if(!todoDb){
  return res.send({
    status:404,
    message:'todo not found',
    data:todoDb
  })
}

  return res.send({
    status:200,
    message:'todo updated successfully',
    data:todoDb
   })  

} catch (error) {
  return res.send({
    status:500,
    message:'todo created successfully',
    error:error
   })  
}

  })

  app.post("/delete-item", async (req, res) => {
    const id = req.body.id;
    console.log(req.body);
  
    if (!id) {
      return res.send({
        status: 400,
        message: "Missing parameters",
      });
    }
  
    try {
      const todoDb = await TodoModel.findOneAndDelete({ _id: id });
      return res.send({
        status: 200,
        message: "Todo Deleted Successfully",
        data: todoDb,
      });
    } catch (error) {
      return res.send({
        status: 500,
        message: "Database error, Please try again",
        error: error,
      });
    }
  }); 


  //pagination
  app.post('/pagination_dashboard',  async(req,res)=>{
    const skip = req.query.skip  || 0
    const LIMIT=2 
    const username = req.session.user.username
    // console.log('400',username)
    try {
      let todos= await TodoModel.aggregate([
        {$match :{username:username}},
        {$facet :{
          data: [{$skip: parseInt(skip)},{$limit:LIMIT}]
        }}
      ])
      // console.log('408',todos)
      return res.send({
        status:200,
        message:'read successful',
        data:todos
      })
    } catch (error) {
      return res.send({
        status:400,
        message:'Database Error, Please try again later',
        error:error
      })  
    }

  })


app.listen(PORT, ()=>{
    console.log(`server is running at port ${PORT}`)
} )