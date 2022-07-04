import React from "react";
import Header from './Header.js';
import Footer from './Footer.js';
import Card from './Card.js';
import UserTasks from './UserTasks.js';

function Todolist () {

    // To-do list Cards
    const userTasks = UserTasks.map(item => {
        return <Card
                    task = {item.task}
                    day = {item.day}
                    urgency = {item.urgency}
                />
    });

    return (
        <>
        <div class="container">
            <Header />

            <h1 class="title">To-do List</h1>
            <form>
                <input className="todoinput"></input>
                <button className="todobutton">Add Task</button>
            </form>
        </div>

        <div className="cards">
            {userTasks}
        </div>

        <Footer />
        
        </>
    );
}

export default Todolist;