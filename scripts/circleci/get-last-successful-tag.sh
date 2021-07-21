#!/bin/bash

BRANCH_NAME=$1
INPUTS_MAIN_BRANCH_NAME=$2
INPUTS_TAG_MATCH_PATTERN=$3
INPUTS_ERROR_ON_NO_MATCHING_TAGS=$4

if [ "$BRANCH_NAME" != $INPUTS_MAIN_BRANCH_NAME ]; then
    BASE_SHA=$(echo $(git merge-base origin/$INPUTS_MAIN_BRANCH_NAME HEAD))
    echo ""
    echo "Branch found. Using base from 'origin/$INPUTS_MAIN_BRANCH_NAME': $BASE_SHA"
    echo ""
else
    # For the base SHA for main builds we use the latest matching tag as a marker for the last commit which was successfully built.
    # We use 2> /dev/null to swallow any direct errors from the command itself so we can provide more useful messaging
    TAG=$(git describe --tags --abbrev=0 --match="$INPUTS_TAG_MATCH_PATTERN" 2> /dev/null)

    if [ -z $TAG ]; then
        if [ $INPUTS_ERROR_ON_NO_MATCHING_TAGS = "true" ]; then
            echo ""
            echo "ERROR: Unable to resolve a latest matching tag on 'origin/$INPUTS_MAIN_BRANCH_NAME' based on the pattern '$INPUTS_TAG_MATCH_PATTERN'"
            echo ""
            echo "NOTE: You have set 'error-on-no-matching-tags' on the action so this is a hard error."
            echo ""
            echo "Is it possible that you have no relevant tags currently on 'origin/$INPUTS_MAIN_BRANCH_NAME' in your repo?"
            echo ""
            echo "- If yes, then you simply need to manually apply a tag which matches the 'tag-match-pattern' of '$INPUTS_TAG_MATCH_PATTERN'."
            echo "- If no, then you likely have an issue with the pattern above as it is not matching the tag you are expecting it to."
            echo ""

            exit 1
        else
            echo ""
            echo "WARNING: Unable to resolve a latest matching tag on 'origin/$INPUTS_MAIN_BRANCH_NAME' based on the pattern '$INPUTS_TAG_MATCH_PATTERN'"
            echo ""
            echo "We are therefore defaulting to use HEAD~1 on 'origin/$INPUTS_MAIN_BRANCH_NAME'"
            echo ""
            echo "NOTE: You can instead make this a hard error by settting 'error-on-no-matching-tags' on the action in your workflow."
            echo ""

            TAG="HEAD~1"
        fi
    else
        echo ""
        echo "Successfully found a matching tag on 'origin/$INPUTS_MAIN_BRANCH_NAME' based on the pattern '$INPUTS_TAG_MATCH_PATTERN'"
        echo ""
        echo "Matching tag: $TAG"
        echo ""
    fi

    BASE_SHA=$(echo $(git rev-parse $TAG~0))
fi

HEAD_SHA=$(git rev-parse HEAD)
