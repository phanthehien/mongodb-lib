FROM jenius2/node:6-alpine
ENV WAIT_START 0

# Install the modules and build the code.
COPY . .
RUN npm install

CMD echo "Waiting for ${WAIT_START}s..." && sleep ${WAIT_START} && npm test
