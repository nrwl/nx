if [ -f "./node_modules/.bin/nx-cloud" ]; then
	./node_modules/.bin/nx-cloud start-agent
elif [ -f "./.nx/installation/node_modules/.bin/nx-cloud" ]; then
    ./.nx/installation/node_modules/.bin/nx-cloud start-agent
else
    echo "Could not find Nx Cloud Agent binary"
    exit 1
fi
