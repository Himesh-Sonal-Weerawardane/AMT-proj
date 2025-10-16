package com.example.accessingdatamysql;

import org.springframework.stereotype.Service;
import java.util.List;

import static java.util.Comparator.comparing;

@Service
public class Statistics {

    private MarkingScoreRepository scoreRepo;

    public double findAverageAssignment(Integer assignmentID){
        double totalMarks = 0;
        long length = scoreRepo.countByAssignmentID(assignmentID);
        List<MarkingScore> scores = scoreRepo.findByAssignmentID(assignmentID);

        for(MarkingScore score : scores){
            totalMarks += score.getMarkingScore();
        }
        return totalMarks / length;
    }

    public double findStandardDeviation(Integer assignmentID){
        List<MarkingScore> scores = scoreRepo.findByAssignmentID(assignmentID);
        double average = findAverageAssignment(assignmentID);
        double numerator = 0;
        for(MarkingScore score : scores){
            numerator += (score.getMarkingScore() - average) * (score.getMarkingScore() - average);
        }

        return Math.sqrt((numerator / scores.size() - 1));

    }

    public double findMaxScore(Integer assignmentID){
        List<MarkingScore> scores = scoreRepo.findByAssignmentID(assignmentID);
        MarkingScore maxScore = scores.stream()
                .max(comparing(MarkingScore::getMarkingScore))
                .orElse(null);

        assert maxScore != null;
        return maxScore.getMarkingScore();
    }

    public double findMinScore(Integer assignmentID){
        List<MarkingScore> scores = scoreRepo.findByAssignmentID(assignmentID);
        MarkingScore minScore = scores.stream()
                .min(comparing(MarkingScore::getMarkingScore))
                .orElse(null);

        assert minScore != null;
        return minScore.getMarkingScore();
    }

    /*public double findMedian(Integer assignmentID){
        List<MarkingScore> scores = scoreRepo.findByAssignmentID(assignmentID);
        MarkingScore median = scores.stream()
                .sorted()
    }*/

}
