#!/bin/bash

command_string_to_echo_as_tag_name=$1

git tag $command_string_to_echo_as_tag_name
git push origin --tags
