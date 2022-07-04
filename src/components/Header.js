import { Link, useNavigate } from 'react-router-dom'

function Header () {
    return (
        <nav className="nav-bar">
            <p>
                <Link to='/home'>Home</Link>
            </p>
            <p>
                <Link to='/todolist'>To-do List</Link>
            </p>
            <p>
                <Link to='/calendar'>Calender</Link>
            </p>
            <p>
                <Link to='/timer'>Timer</Link>
            </p>
            <p>
                <Link to='/analytics'>Analytics</Link>
            </p>
            <p>
                <Link to='/achievements'>Achievements</Link>
            </p>
            <p>
                <Link to='/about'>About</Link>
            </p>
        </nav>
    )
}

export default Header;