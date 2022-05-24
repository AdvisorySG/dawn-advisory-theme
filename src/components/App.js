import Header from './Header.js';
import Home from './Home.js';
import Footer from './Footer.js';
import Card from './Card.js';
import UserTasks from './UserTasks.js';
import Todolist from './Todolist.js';

function Page () {
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

export default Page;