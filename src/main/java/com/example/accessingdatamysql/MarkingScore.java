package com.example.accessingdatamysql;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
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
    private Assignment assignment;

    public Integer getMarkID(){
        return markID;
    }
    public void setMarkID(Integer markID){
        this.markID = markID;
    }

    public Assignment getAssignment(){
        return assignment;
    }
    public void setAssignment(Assignment assignment){
        this.assignment = assignment;
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
    public void setMarkingScore(){
        this.markingScore = markingScore;
    }
}
