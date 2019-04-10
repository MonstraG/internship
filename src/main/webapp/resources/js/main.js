const app = angular.module("app", ['ngRoute']);
app.controller('RouteController', function() {
}).config(function($routeProvider) {
    $routeProvider
        .when('/map', {
            templateUrl: 'static/map.jsp',
            controller: 'MapController'
        })
        .when('/register', {
            templateUrl: 'static/register.jsp',
            controller: 'RegisterController'
        })
        .otherwise({redirectTo:'/map'});
});

app.controller('MapController', function($scope, $http) {
    $scope.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 4,
        center: {lat: 0, lng: 0}
    });
    let currentKeySubscription = null;
    const markers = []; //0 is always newest.
    const markerPath = new google.maps.Polyline({
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: $scope.map
    });

    $scope.options = {
        key: "",
        displayAmount: 5,
        maxMarkerAmount: 50,
        followNewMarkers: false,
    };

    $scope.activeKeys = new Set();

    const socket = new WebSocket("ws://localhost:8080/messaging-endpoint");
    const stompClient = Stomp.over(socket);
    stompClient.connect({}, function () {
        //general device update subscription
        stompClient.subscribe('/location-updates-any/',
            payload => $scope.activeKeys.add(payload.body));
    });

    //initial get
    $http.get('/userdata').then(response => {
        $scope.username = response.data.username;
        //get keys
        $http.get('/keys/' + $scope.username).then(response => {
            $scope.keys = response.data;
            console.log($scope.keys)
        }, error => console.error(error));

        $scope.options.maxMarkerAmount = response.data.markerAmount;
        const ticks = [
            5,
            (5 + $scope.options.maxMarkerAmount) / 4,
            (5 + $scope.options.maxMarkerAmount) / 2,
            3 * (5 + $scope.options.maxMarkerAmount) / 4,
            $scope.options.maxMarkerAmount
        ];
        $scope.marker_amount_ticks = ticks.map(tick => Math.ceil(tick / 5) * 5)
    }, error => console.error(error));


    $scope.updateActiveDevices = function () {
        $scope.keys.map(key => {
            let label = document.getElementById(key.key+'-span');
            if ($scope.activeKeys.has(key.key)) {
                label.classList.add('activeKey')
            } else {
                label.classList.remove('activeKey')
            }
        });
        $scope.activeKeys.clear();
    };
    const deviceUpdate = setInterval($scope.updateActiveDevices, 10000);
    $scope.$on("$destroy", function () {clearInterval(deviceUpdate);});

    //key switch
    $scope.getNewMarkers = function(){
        if (currentKeySubscription !== null) {
            stompClient.unsubscribe(currentKeySubscription.id);
        }
        currentKeySubscription = stompClient.subscribe('/location-updates/' + $scope.options.key,
            response => {
                const location = JSON.parse(response.body);
                if (markers.length > 0) {
                    markers[0].setMap(null);
                }
                markers.unshift(new google.maps.Marker({
                    position: new google.maps.LatLng(location.latitude, location.longitude),
                }));
                while(markers.length > $scope.options.maxMarkerAmount) {
                    markers[markers.length - 1].setMap(null);
                    markers.pop();
                }
                $scope.onMarkerChange()
            });

        $http.get('/location/' + $scope.options.key + '/' + $scope.options.maxMarkerAmount).then(response => {
            $scope.forgetAllMarkers();
            response.data.map(location => {
                markers.push(new google.maps.Marker({
                    position: new google.maps.LatLng(location.latitude, location.longitude),
                }));
            });
            $scope.onMarkerChange()
        }, error => console.error(error));
    };

    $scope.onMarkerChange = function() {
        if (markers.length > 0) {
            const path = markers.slice(0, $scope.options.displayAmount).map(marker => marker.position);
            markerPath.setPath(path);
            markers[0].setMap($scope.map);
            if ($scope.options.followNewMarkers === 'true') {
                $scope.centerMap();
            }
        }
    };

    $scope.centerMap = function() {
        if (markers.length > 0) {
            $scope.map.setCenter(markers[0].position);
        }
    };

    $scope.forgetAllMarkers = function () {
        markers.map(marker => marker.setMap(null));
        markers.length = 0;
    };
});

app.controller('RegisterController', function() {});


/*TODO: add register page where new users would be added, and go there via button in header. all is controlled by ngroute.
    So, total list:
    - New registration page
    - New controller method to register (which may include checking existence).
    - (maybe) also add key adding interface because we actually have controller method for this?
*/