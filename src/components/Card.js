function Card (props) {
    return (
        <div className="card">
            <p className="task">{ props.task }</p>
            <p className="day">{ props.day }</p>
            <p className="urgency">{ props.urgency }</p>
        </div>
    );
};

export default Card;