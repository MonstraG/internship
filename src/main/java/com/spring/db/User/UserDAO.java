package com.spring.db.User;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;

@Repository
@Transactional
public class UserDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UserMapper userMapper = new UserMapper();

    public User getUserByUsername(String username) {
        String SQL_FIND_KEY = "select * from users where username = ?";
        return jdbcTemplate.query(SQL_FIND_KEY, new Object[]{username}, new ResultSetExtractor<User>() {
            public User extractData(ResultSet resultSet) throws SQLException, DataAccessException {
                if (resultSet.next())
                    return userMapper.mapRow(resultSet, 1);
                return null;
            }
        });
    }
}