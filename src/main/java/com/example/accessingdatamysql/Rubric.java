package com.example.accessingdatamysql;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.List;

@Entity
public class Rubric {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Integer rubricID;

    private String rubricTitle;

    private Assignment assignment;

    private List<Criteria> criteria;

    public Integer getRubricID(){
        return rubricID;
    }
    public void setRubricID(Integer rubricID){
        this.rubricID = rubricID;
    }

    public String getRubricTitle(){
        return rubricTitle;
    }
    public void setRubricTitle(String rubricTitle){
        this.rubricTitle = rubricTitle;
    }

    public Assignment getAssignment(){
        return assignment;
    }
    public void setAssignment(Assignment assignment){
        this.assignment = assignment;
    }

    public List<Criteria> getCriteria(){
        return criteria;
    }
    public void setCriteria(List<Criteria> critieria){
        this.criteria = critieria;
    }
}
