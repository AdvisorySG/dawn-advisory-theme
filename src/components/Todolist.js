import React from "react";

function Todolist () {
    return (
        <div>
            <h1 class="title">To-do List</h1>
            <form>
                <input className="todoinput"></input>
                <button className="todobutton">Add Task</button>
            </form>
        </div>
    )
}

export default Todolist;