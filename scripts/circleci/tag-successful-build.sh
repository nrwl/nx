#!/bin/bash

command_string_to_echo_as_tag_name=$1
INPUTS_TAG_MATCH_PATTERN=$2

# remove all tags first
git push -d origin $(git tag -l "$INPUTS_TAG_MATCH_PATTERN")
# set single tag
git tag $command_string_to_echo_as_tag_name
git push origin $command_string_to_echo_as_tag_name
