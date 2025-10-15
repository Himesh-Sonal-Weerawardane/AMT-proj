package com.example.accessingdatamysql;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Assignment {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Integer assignmentID;

    private String assignmentName;

    private Integer getAssignmentID() {
        return assignmentID;
    }

    public void setAssignmentID(Integer assignmentID){
        this.assignmentID = assignmentID;
    }

    public String getAssignmentName(){
        return assignmentName;
    }
    public void setAssignmentName(String assignmentName){
        this.assignmentName = assignmentName;
    }

}
