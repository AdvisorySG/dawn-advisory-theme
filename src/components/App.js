import Header from './Header.js';
import Home from './Home.js';
import Footer from './Footer.js';
import Card from './Card.js';
import UserTasks from './UserTasks.js';

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
            <h1 class="title">Todo List</h1>
            {/* <Home /> */}
            {userTasks}
            <Footer />
        </div>
    );
};

export default Page;