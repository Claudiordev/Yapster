Practice Session:

-> Java Developers
-> Spring Boot & Java


- React hooks
- React state management
- shared storage
- state transfer or data transfer between multiple react components.
- How do you check if object is being mutated.
- Where do you store the object if it’s really large .
- What is prop drilling.
- When to use redux or react store.
- If object is getting mutated and two objects are referencing to it how would you know from objects that it’s mutated.
- Given an object if the state is changing you want to rerender as minimum as possible how will you handle it.
- What is the use of the key when rendering a list in React
- If you have a scenario where UI is polling for status from the backend and you need to show the process on UI based on the status, the progress increases by 10% after 4 seconds, but when the polling result is received, we rerender the component, and the process restarts. How can we solve this?

--------------------------------------------------------

You’re building a React application that polls an API every few seconds. The response is a large, deeply nested JSON object like the ones below.

Your goal is to display only a few fields (e.g., state, stage, and providerDetails.displayName) at a time, depending on the state, and avoid unnecessary re-renders. Different screens take different part of the payload.

The payload structure can vary significantly different between responses.

•⁠  ⁠How would you model the data and structure your component to handle this efficiently?
•⁠  ⁠Which state management strategy would you use? (useState, React.Context, Redux, something else?)


⁠ json
{
"flowId": "e3f1c9a2-4d7b-4f3a-9c2e-1a2b3c4d5e6f",
"state": "AWAITING_USER_INTERACTION",
"stage": "NEED_AUTHENTICATION",
"parameters": {
"userId": "user-12345",
"market": "SE",
"userLocale": "en_US",
"clientRedirectUri": "https://demo.example.com/callback"
},
"providerDetails": {
"providerName": "bank",
"displayName": "Fancy bank Name",
"displayDescription": "Fancy payment provider",
"iconUrl": "https://cdn.example.com/provider-images/br-celcoin.png"
},
"paymentDetails": {
"id": "payment-98765"
},
"enrollmentDetails": {
"id": "enroll-54321",
"brandId": "brand-001",
"status": "PENDING",
"authorizationUrl": "https://auth.example.com/start",
"payerDetails": {
"name": "João Silva",
"document": "123.456.789-00"
},
"errorDetails": null
},
"authorizationDetails": {
"authorizationType": "ENROLLMENT_INITIATION",
"recommendedHandoffSca": true,
"templateFields": [],
"thirdPartyAuthentication": {
"desktop": {
"url": "https://auth.example.com/desktop"
},
"android": {
"intent": "intent://auth.example.com/android"
},
"ios": {
"deepLinkUrl": "app://auth.example.com/ios"
}
}
},
"errorDetails": null,
"actions": [
{
"name": "submitFields",
"uri": "/api/v1/flows/e3f1c9a2/action",
"method": "POST"
},
{
"name": "cancelFlow",
"uri": "/api/v1/flows/e3f1c9a2/cancel",
"method": "POST"
}
],
"availableProviders": [
{
"providerName": "br-celcoin",
"displayName": "CELCOIN",
"iconUrl": "https://cdn.example.com/provider-images/br-celcoin.png"
},
{
"providerName": "br-picpay",
"displayName": "PicPay",
"iconUrl": "https://cdn.example.com/provider-images/br-picpay.png"
}
]
}


Do it more parallel request?

Requirement of only 10 minutes

Resilience4J circuit breaker

RateLimiter, Timeout, Fault Taulerance in Microservices in Rest Communications.

System.currentTime in Millis, is not very testable? My Own class, Like a Clock Class, Then I can mock My own class, it's very difficult to test that, What is pessimist and optimistic locking? What's the difference? Lock on that user, when there's an action, you take locks so it makes sure it only happens once?

Scheduler, multiple instances with a scheduler and then it would do it every 24 hours, but you just want to do it in one instance, how do you make sure it's just one instance?
Indexes SQL -
Exception Handling on Spring Boot -
Idempotency Spring Boot -
Rate Limit -
Correlation ID is more for tracking a request between services -
API Gateway -
Rate limit not more than 10 times, how to do it, Resilience4J -
You want to do a max of 10 request, and you have 5 instances, how do you make sure you share this variable that counts the request to be only 10 on all the instanc? Redis? Shared cache?

Given a json string, define how should the java response class look like.
they are interested in checking if you know what datatypes to consider.

Clustering, Locking? How to improve performance of the API, How to do async calls?

"accounts": [
{
"availableBalance": "12000.00",
"currency": [
"SEK",
"Swedish krona"
],
"id": "7494b0a8-2679-429c-9ed5-980abdefcc1b",
"links": {
"balances": "http://demo.com/api/accounts/7494b0a8-2679-429c-9ed5-980abdefcc1b/balances",
"transactions": "http://demo.com/api/accounts/7494b0a8-2679-429c-9ed5-980abdefcc1b/transactions?from=2021-07-21&to=2021-10-20&includePending=false"
},
"number": "PL57123456780000000000047069",
"owner": "Christine Hernandez"
},
{
"availableBalance": "9400.00",
"currency": [
"LSL",
"Lesotho loti"
],
"id": "09380b7d-7bd1-bc93-54ab-8bf7cc2e9ca4",
"links": {
"balances": "http://demo.com/api/accounts/09380b7d-7bd1-bc93-54ab-8bf7cc2e9ca4/balances",
"transactions": "http://demo.com/api/accounts/09380b7d-7bd1-bc93-54ab-8bf7cc2e9ca4/transactions?from=2021-07-21&to=2021-10-20&includePending=false"
},
"number": "PL25123456780000000000095563",
"owner": "Christine Hernandez"
}
]
⁠ ⁠}

You should always take BigDecimal because they take more precision, not double




Find problems and code review the below class

package com.bank.integration.service;

import com.bank.integration.client.BankApiClient;
import com.bank.integration.model.Transaction;
import com.bank.integration.model.TransactionStats;
import com.bank.integration.repository.AccountStatsRepository;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;



public class TransactionService {

    @Autowired
    private BankApiClient bankApiClient;

    @Autowired
    private com.bank.integration.service.AccountStatsRepository accountStatsRepository;

    private List<com.bank.integration.service.Transaction> cachedTransactions = new ArrayList<>();

    private final int MAX_RETRIES = 3;

    public static com.bank.integration.service.TransactionStats getTransactionsForPeriod(
            String accountNumber,
            LocalDate startDate,
            LocalDate endDate) {

        List<Transaction> allTransactions = new ArrayList<>();

        // Fetch transactions month by month
        LocalDate currentStart = startDate;
        while (currentStart.isBefore(endDate)) {
            LocalDate currentEnd = currentStart.plusMonths(1);

            List<Transaction> monthlyTransactions =
                    bankApiClient.fetchTransactions(accountNumber, currentStart, currentEnd);

            allTransactions.add(monthlyTransactions);

            currentStart = currentEnd;
        }

        // Cache for later use
        cachedTransactions = allTransactions;

        // Update database
        accountStatsRepository.updateTransactionCount(
                accountNumber,
                allTransactions.size()
        );

        // Calculate total amount
        BigDecimal totalAmount = calculateTotalAmount(allTransactions);

        // Sort transactions by date (newest first)
        allTransactions.sort((t1, t2) -> t1.getDate().compareTo(t2.getDate()));

        return new TransactionStats(totalAmount, allTransactions);
    }

    private static BigDecimal calculateTotalAmount(List<Transaction> transactions) {
        // TODO: Implement this method
        // Calculate and return the sum of all transaction amounts
        // Handle null/empty list case - return BigDecimal.ZERO
        // Handle null amounts in individual transactions - skip them

        return null;
    }

    public void setMaxRetries(int retries) {
        MAX_RETRIES = retries;
    }

    public String getAccountSummary(String accountNumber) {
        return "Account: " + accountNumber + " has " + cachedTransactions.size() + " transactions";
    }
}


There is a REST endpoint which receives a "file" in a post request from a user. You can think of the file as a json blob. Service A receives the file "Should always accept it and respond 200/OK". It persists the file in some storage. Service B's responsibility is to take the persisted file and process it in some way and then also persist the processed file in the storage. The storage should be accessible by staff to be looked at.

Then they asked me some questions about it. These should be most of them, but I might have missed some:
How would you make the post request idempotent? How would you handle it in the service? What http status code should you return for a duplicate request? What http status code should you return if you use the same idempotency key for a different request?
How would you have Service A and Service B communicate with each other?
How would you go about to authorize the user?
How would you handle multiple versions of the API?
How would you handle really large files on the scale of gigabytes?
In AWS how would you make sure that only the correct people have access to the storage?

"-What is Blue Green deployment? Pros and cons of it?

-How do you deploy code to prod? How is your CI/CD setup? What is the whole process from requirement till deployment?

-How do you deal with issues on PROD? How do you solve them?

-How do you monitor your system?

-How do you maintain code quality? What tools you use for code quality? Like unit testing, sonarqube etc

For all questions: May be in your current company you don't have an ideal setup. But make sure you know what is the best solution or best setup for the problem."

"How will you make system highly available? 99.99 up how will you do it?
DO you know Kubectl ? and about kubernetes?
If bank response in JSON or XML ?  how will you store ?
How will you decide which database to choose in the design question?
If read request is more then which database will you use?"