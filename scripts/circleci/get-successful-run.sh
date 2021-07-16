#!/bin/bash

PROJECT_SLUG="$1/$2/$3"
BRANCH_NAME=$4
INPUTS_MAIN_BRANCH_NAME=$5
INPUTS_ERROR_ON_NO_SUCCESSFUL_WORKFLOW=$6

if [ "$BRANCH_NAME" != $INPUTS_MAIN_BRANCH_NAME ]; then
    BASE_SHA=$(echo $(git merge-base origin/$INPUTS_MAIN_BRANCH_NAME HEAD))
    echo ""
    echo "Branch found. Using base from 'origin/$INPUTS_MAIN_BRANCH_NAME': $BASE_SHA"
    echo ""
else
    # We will make an https request to CircleCI API getting all the pipelines from the $INPUTS_MAIN_BRANCH_NAME on $PROJECT_SLUG
    # For each pipeline we check if it was successful and whether the commit still exists
    BASE_SHA=$(node scripts/circleci/find-successful-workflow.js $INPUTS_MAIN_BRANCH_NAME $PROJECT_SLUG )

    if [ -z $BASE_SHA ]; then
        if [ $INPUTS_ERROR_ON_NO_SUCCESSFUL_WORKFLOW = "true" ]; then
            echo ""
            echo "ERROR: Unable to find a successful workflow run on 'origin/$INPUTS_MAIN_BRANCH_NAME'"
            echo ""
            echo "NOTE: You have set 'error-on-no-successful-workflow' on the action so this is a hard error."
            echo ""
            echo "Is it possible that you have no runs currently on 'origin/$INPUTS_MAIN_BRANCH_NAME' in your repo?"
            echo ""
            echo "- If yes, then you should run the workflow without this flag first."
            echo "- If no, then you might have changed your git history and those commits no longer exist."
            echo ""

            exit 1
        else
            echo ""
            echo "WARNING: Unable to find a successful workflow run on 'origin/$INPUTS_MAIN_BRANCH_NAME'"
            echo ""
            echo "We are therefore defaulting to use HEAD~1 on 'origin/$INPUTS_MAIN_BRANCH_NAME'"
            echo ""
            echo "NOTE: You can instead make this a hard error by settting 'error-on-no-successful-workflow' on the action in your workflow."
            echo ""

            SHA="HEAD~1"
        fi
    else
        echo ""
        echo "Found the last successful workflow run on 'origin/$INPUTS_MAIN_BRANCH_NAME'"
        echo ""
        echo "Commit: $BASE_SHA"
        echo ""
    fi
fi

HEAD_SHA=$(git rev-parse HEAD)
