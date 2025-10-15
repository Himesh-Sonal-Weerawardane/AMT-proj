package com.example.accessingdatamysql;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

public class CriteriaScore {

    @Id
    @GeneratedValue(strategy=GenerationType.AUTO)
    private Integer criteriaScoreID;

    private Integer criteriaScore;
    private MarkingScore markingScore;

    private Criteria criteria;



    public Integer getCriteriaScoreID() {
        return criteriaScoreID;
    }

    public void setCriteriaScoreID(Integer criteriaScoreID) {
        this.criteriaScoreID = criteriaScoreID;
    }

    public Integer getCriteriaScore() {
        return criteriaScore;
    }

    public void setCriteriaScore(Integer criteriaScore) {
        this.criteriaScore = criteriaScore;
    }

    public MarkingScore getMarkingScore() {
        return markingScore;
    }

    public void setMarkingScore(MarkingScore markingScore) {
        this.markingScore = markingScore;
    }

    public Criteria getCriteria() {
        return criteria;
    }

    public void setCriteria(Criteria criteria) {
        this.criteria = criteria;
    }
}
