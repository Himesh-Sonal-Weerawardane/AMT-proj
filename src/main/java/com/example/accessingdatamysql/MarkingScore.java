package com.example.accessingdatamysql;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.List;

@Entity
public class MarkingScore {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Integer markID;

    private Double markingScore;
    private List<CriteriaScore> criteriaScores;

    private User user;
    private Assignment assignmentID;

    public Integer getMarkID(){
        return markID;
    }
    public void setMarkID(Integer markID){
        this.markID = markID;
    }

    public Assignment getAssignmentID(){
        return assignmentID;
    }
    public void setAssignmentID(Assignment assignmentID){
        this.assignmentID = assignmentID;
    }

    public User getUser(){
        return user;
    }
    public void setUser(User user){
        this.user = user;
    }

    public Double getMarkingScore(){
        return markingScore;
    }
    public void setMarkingScore(Double markingScore){
        this.markingScore = markingScore;
    }
}
