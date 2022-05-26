import Header from './components/Header.js';
import Home from './components/Home.js';
import Footer from './components/Footer.js';
import Card from './components/Card.js';
import UserTasks from './components/UserTasks.js';
import Todolist from './components/Todolist.js';
import './App.css';

function App() {
    const userTasks = UserTasks.map(item => {
        return <Card
                    task = {item.task}
                    day = {item.day}
                    urgency = {item.urgency}
                />
    });

    return (
        <div class="container">
            <Header />
            <Todolist />
            {userTasks}
            <Footer />
        </div>
    );
};

export default App;