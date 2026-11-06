require('dotenv').config();
const mysql=require('mysql2/promise');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const readline=require('readline/promises');
const {stdin:input,stdout:output}=require('process');
(async()=>{
 const rl=readline.createInterface({input,output});let conn;
 try{
  if(!process.env.DB_HOST||!process.env.DB_USER||!process.env.DB_NAME)throw new Error('Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in your local .env first.');
  conn=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME,ssl:String(process.env.DB_SSL||'false')==='true'?{rejectUnauthorized:true}:undefined});
  const firstName=(await rl.question('First name: ')).trim();const lastName=(await rl.question('Last name: ')).trim();const email=(await rl.question('Admin email: ')).trim().toLowerCase();const phone=(await rl.question('Phone: ')).trim();const password=await rl.question('Password (minimum 12 characters): ');const confirm=await rl.question('Confirm password: ');
  if(!firstName||!lastName||!email.includes('@')||!phone)throw new Error('Complete all fields with a valid email.');if(password.length<12||password!==confirm)throw new Error('Passwords must match and contain at least 12 characters.');
  const adminId='SP-ADMIN-'+crypto.randomBytes(4).toString('hex').toUpperCase();const controlKey='SPK-'+crypto.randomBytes(8).toString('hex').toUpperCase();const hash=await bcrypt.hash(password,12);
  const [r]=await conn.execute("INSERT INTO admins(admin_id,control_key,first_name,last_name,email,phone,password_hash,status) VALUES(?,?,?,?,?,?,?,'active')",[adminId,controlKey,firstName,lastName,email,phone,hash]);
  console.log('\nAdministrator created. Save these credentials securely:');console.log('Admin ID: '+adminId);console.log('Control Key: '+controlKey);console.log('Email: '+email);console.log('Database admin record ID: '+r.insertId);console.log('\nThe password is not printed or stored in plaintext.');
 }catch(e){console.error('\nAdmin creation failed: '+e.message);process.exitCode=1;}finally{if(conn)await conn.end();rl.close();}
})();
