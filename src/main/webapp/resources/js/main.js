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
        .when('/newUseer', {

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

    $scope.keyInstaller = {
        installNewKey: false,
        keyToInstall: "1"
    };

    $scope.logoutWindowOpen = false;
    setTimeout(function () {
        document.getElementById("logoutWindow").hidden = false;
    }, 50);


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

        $scope.getKeys();

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

    $scope.getKeys = function () {
        $http.get('/keys/' + $scope.username).then(response => {
            $scope.keys = response.data;
        }, error => console.error(error));
    };

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

    $scope.onInstallNewKeyBtn = function () {
        if (!$scope.keyInstaller.installNewKey) {
            $scope.keyInstaller.installNewKey = true;
            setTimeout(function() {document.getElementById("keyinstaller").focus()}, 0);
            $scope.keyInstaller.keyToInstall = "";
        } else {
            if ($scope.keyInstaller.keyToInstall !== "") {
                $http.post('/install', {'username': $scope.username, 'key': $scope.keyInstaller.keyToInstall})
                    .then(resp => {
                        $scope.getKeys();
                    }
                );
            }
            $scope.keyInstaller.installNewKey = false;
        }
    };

    $scope.switchLogoutWindow = function () {
        document.getElementById("logoutWindow").classList.toggle("hidden");
    }
});

app.controller('RegisterController', function($scope, $http) {
    $scope.userData = {
        username: "",
        password: "",
        role: 'USER',
        enabled: true
    };

    $scope.userExists = false;
    $scope.formNotValid = false;
    $scope.userSuccessfullyCreated = false;

    $scope.register = function () {
        $scope.userExists = false;
        $scope.formNotValid = false;
        $scope.userSuccessfullyCreated = false;
        if ($scope.userData.username === "" || $scope.userData.password === "") {
            $scope.formNotValid = true;
        } else {
            $http.post('/register', JSON.stringify($scope.userData)).then(response => {
                if (response.data === "User already exists.") {
                    $scope.userExists = true;
                } else {
                    $scope.userSuccessfullyCreated = true;
                }
            }, error => console.error(error));
        }
    }
});