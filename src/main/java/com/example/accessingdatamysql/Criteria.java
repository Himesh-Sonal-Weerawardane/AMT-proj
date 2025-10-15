package com.example.accessingdatamysql;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.List;

@Entity
public class Criteria {
    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Integer criteriaId;

    private String criteriaTitle;

    private List<CriteriaScore> criteriaScore;

    private Integer score;

    private Rubric rubric;

    public Integer getCriteriaId(){
        return criteriaId;
    }
    public void setCriteriaId(Integer criteriaId){
        this.criteriaId = criteriaId;
    }

    public String getCriteriaTitle(){
        return criteriaTitle;
    }
    public void setCriteriaTitle(String criteriaTitle){
        this.criteriaTitle = criteriaTitle;
    }

    public List<CriteriaScore> getCriteriaScore() {
        return criteriaScore;
    }

    public void setCriteriaScore(List<CriteriaScore> criteriaScore) {
        this.criteriaScore = criteriaScore;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public Rubric getRubric() {
        return rubric;
    }

    public void setRubric(Rubric rubric) {
        this.rubric = rubric;
    }
}

