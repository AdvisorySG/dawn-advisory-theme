import { Link, useNavigate } from 'react-router-dom'
import { UserAuth } from '../context/AuthContext'
import Header from './Header';
import Footer from './Footer';
import homepageBackground from "./img/homepage-bg.jpg";

const Home = () => {

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
         <div className="home-page-container">
             <Header/>
            <h1>studyPal</h1>
            <p>A productivity application to help you plan out your busy days!</p>
            <p class='home-emailacc'>Account : { user.email }</p>
            <button class = 'home-signout' onClick={handleLogout}>Sign out</button>
            <img src={homepageBackground} className="home-page-background"/>
            <Footer/>
        </div>
    )
}

export default Home;

