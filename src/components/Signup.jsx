import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const Signup = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const { createUser } = UserAuth() 
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await createUser(email, password)
            navigate('/Home')
        } catch (e) {
            setError(e.message)
            console.log(e.message)
        }
    }

    return (
        <div className='signup'>
            <div>
                <h1>Sign up</h1>
                <p>Already have an account? {' '}
                   <Link to='/login'>Log in</Link>
                </p>
            </div>
            <div>
                <form class='signup' onSubmit={handleSubmit}>
                    <div>
                        <label class='signup-label'>Email Address</label>
                        <input class='signup-input' 
                            onChange={(event) => {
                                setEmail(event.target.value)
                            }}
                            type='email'
                        />
                    </div>
                    <div>
                        <label class='signup-label'>Password</label>
                        <input class='signup-input'
                            onChange={(event) => {
                                setPassword(event.target.value)
                            }}
                            type='password'
                        />
                    </div>
                    <div>
                        <button class='login-button'>Sign Up</button>
                        <p><Link to='/'>Home</Link></p>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Signup;
