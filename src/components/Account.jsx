import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'

const Account = () => {

    const { user, logout } = UserAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        try {
            await logout()
            navigate('/')
            console.log('You are logged out')
        } catch (e) {
            console.log(e.message)
        }
    }

    return (
        <div>
            <h1>Welcome back to studyPal!</h1>
            <p>Home page</p>
            <p>{ user.email }</p>
            <button onClick={handleLogout}>Sign out</button>
        </div>
    )
}

export default Account;