import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext';

const Signin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signIn } = UserAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('')
    try {
      await signIn(email, password)
      navigate('/home')
    } catch (e) {
      setError(e.message)
      console.log(e.message)
    }
  };

  return (
    <div className='login'>
      <div>
        <h1>Log in to your account</h1>
        <p>
          Don't have an account yet?{' '}
          <Link to='/signup' className='underline'>Sign up.</Link>
        </p>
      </div>
      <div>
        <form class='login' onSubmit={handleSubmit}>
          <div>
            <label class='login-label'>Email Address</label>
            <input class='login-input' 
                   onChange={(e) => setEmail(e.target.value)} 
                   type='email' 
            />
          </div>
          <div>
            <label class='login-label'>Password</label>
            <input class='login-input' onChange={(e) => setPassword(e.target.value)} type='password' />
          </div>
          <div>
            <button class='login-button'>Log In</button>
            <p><Link to='/'>Home</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signin;
/*
import userEvent from '@testing-library/user-event'
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'
import { useState } from 'react'
import { signInWithRedirect } from 'firebase/auth'

const Login = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { logIn } = UserAuth()

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('')
        try {
            await logIn(email, password)
            navigate('/Home')
        } catch (e) {
            setError(e.message)
            console.log(e.message)
        }
    }
 

    return (
        <div>
            <h1>Login</h1>
            <p>Do not have an account?<Link to='/signup'>Sign up</Link></p>
            <form >
                <div>
                    <label>Email Address</label>
                    <input 
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div>
                    <label>Password</label>
                    <input 
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <div>
                    <button>Submit</button>
                    <p><Link to='/'>Home</Link></p>
                </div>
            </form>
        </div>
    )
}

export default Login;

/*
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const Login = () => {
    const { logIn } = UserAuth();

    return (
        <div>
            <h1>Login</h1>
            <p>Do not have an account?<Link to='/signup'>Sign up</Link></p>
            <form>
                <div>
                    <label>Email Address</label>
                    <input type='email'></input>
                </div>
                <div>
                    <label>Password</label>
                    <input type='password'></input>
                </div>
                <div>
                    <button>Submit</button>
                    <p><Link to='/'>Home</Link></p>
                </div>
          </form>
        </div>
    )
}

export default Login;
*/
